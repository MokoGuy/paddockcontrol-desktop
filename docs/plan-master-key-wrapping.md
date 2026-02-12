# Plan: Master Key Wrapping & Multi-Method Unlock

> Implementation plan for [Issue #83](https://github.com/MokoGuy/paddockcontrol-desktop/issues/83)
> Addresses hardware security key & platform-native key protection.

## Table of Contents

- [Executive Summary](#executive-summary)
- [Current Architecture](#current-architecture)
- [Target Architecture](#target-architecture)
- [Methods Retained & Rationale](#methods-retained--rationale)
- [Method Dropped & Rationale](#method-dropped--rationale)
- [Phase 1 — Foundation: Master Key + Argon2id](#phase-1--foundation-master-key--argon2id)
- [Phase 2 — Convenience: OS-Native Protection](#phase-2--convenience-os-native-protection)
- [Phase 3 — Hardware: FIDO2 hmac-secret](#phase-3--hardware-fido2-hmac-secret)
- [Database Migration](#database-migration)
- [Frontend Changes](#frontend-changes)
- [Risk Mitigation](#risk-mitigation)
- [Sources & References](#sources--references)

---

## Executive Summary

PaddockControl currently encrypts certificate private keys with AES-256-GCM using a direct SHA-256 hash of a user-provided password. This plan introduces a **master key wrapping architecture** where a random 32-byte master key encrypts all data, and multiple independent methods can wrap/unwrap that master key.

Three methods are retained; one is dropped:

| Method | Verdict | Phase | Rationale |
|---|---|---|---|
| **M1: Password (Argon2id)** | KEEP | 1 | Portable recovery, zero dependencies |
| **M2: OS-Native (DPAPI/Keyring)** | KEEP | 2 | "Remember me" UX, zero CGo |
| **M3: FIDO2 hmac-secret** | KEEP | 3 | Hardware security, industry-validated pattern |
| **M4: YubiKey PIV (RSA-2048)** | DROP | — | Redundant with M3, requires CGo, cleartext USB |

---

## Current Architecture

```
User Password (string, min 16 chars)
        │
        ▼
  SHA-256(password) ──► 32-byte AES key
        │
        ▼
  AES-256-GCM encrypt/decrypt each certificate private key
```

**Files involved:**
- `internal/crypto/encrypt.go` — `EncryptPrivateKey()` / `DecryptPrivateKey()`
- `app_encryption_key.go` — `ProvideEncryptionKey()`, `ChangeEncryptionKey()`, `ClearEncryptionKey()`
- `app.go` — `App` struct holds `encryptionKey []byte` in memory

**Current weaknesses:**
- No salt → identical passwords produce identical keys
- No stretching → fast brute-force if DB is compromised
- Password re-entered every session (no persistence)
- `ChangeEncryptionKey()` must re-encrypt ALL certificates atomically
- No hardware security option

---

## Target Architecture

```
┌──────────────────────────────────────────────────────┐
│            Master Key  (32 bytes, random)             │
│      (encrypts all certificate private keys)          │
└────────┬─────────────────┬─────────────────┬──────────┘
         │                 │                 │
   ┌─────▼─────┐    ┌─────▼──────┐    ┌─────▼──────────┐
   │  Argon2id  │    │   DPAPI /  │    │     FIDO2      │
   │  Password  │    │   Keyring  │    │  hmac-secret   │
   │   (M1)     │    │    (M2)    │    │     (M3)       │
   └────────────┘    └────────────┘    └────────────────┘
    Portable          Machine-local     Hardware-bound
    Recovery          "Remember me"     Max entropy
```

**Key principle:** Each method wraps the same master key independently. Adding or removing a method never requires re-encrypting certificate data.

**Unlock flow:**
1. User provides credentials via any enrolled method
2. Method unwraps → master key (32 bytes)
3. Master key decrypts certificate private keys (existing AES-256-GCM)

**Key change flow (simplified):**
- Only the wrapping entries in `security_keys` need updating
- Certificate data remains untouched

---

## Methods Retained & Rationale

### Method 1: Password Wrapping (Argon2id)

**Why keep:** Mandatory fallback. Without it, hardware loss = permanent data loss.

**What changes from current:**
- Replace `SHA-256(password)` with `Argon2id(password, salt)` for key derivation
- Derived key wraps/unwraps the master key (not certificate data directly)
- Random salt per enrollment, stored in `security_keys.metadata`

**Argon2id parameters** (OWASP recommended):
```
memory:      64 MiB
iterations:  3
parallelism: 4
key_length:  32 bytes
salt_length: 16 bytes
```

**Go dependency:** `golang.org/x/crypto/argon2` (pure Go, already in stdlib extended).

**Security improvement:** With a proper KDF, even if the database is exfiltrated, brute-force cost goes from milliseconds (SHA-256) to seconds per attempt (Argon2id).

### Method 2: OS-Native Protection (DPAPI / Keyring)

**Why keep:** Eliminates the daily friction of re-entering a password. This is the pattern every password manager uses for local unlock.

**Implementation per platform:**

| Platform | Backend | Access |
|---|---|---|
| Windows | DPAPI (`CryptProtectData`) | `syscall` — no CGo |
| Linux | Secret Service API (GNOME Keyring / KWallet) | D-Bus via `github.com/keybase/go-keychain` or `github.com/zalando/go-keyring` — no CGo |

**Behavior:**
- On enrollment: master key is encrypted with OS-native API, stored in `security_keys`
- On unlock: OS-native API decrypts → master key
- Machine-specific: works only on the enrolled machine/user session
- If OS credential store is wiped, user falls back to M1 (password)

**UX:** Checkbox "Remember me on this computer" in the unlock dialog.

### Method 3: FIDO2 hmac-secret

**Why keep:** This is the exact pattern Bitwarden uses to unlock vaults with passkeys. It has been validated at scale by the industry.

**How it works:**
```
Salt (app-specific, stored in security_keys.metadata)
        │
        ▼
  FIDO2 Authenticator computes:
    HMAC-SHA-256(credential_internal_key, salt)
        │
        ▼
  32-byte deterministic secret
        │
        ▼
  HKDF-SHA-256(secret, info="paddockcontrol-master-key-wrap")
        │
        ▼
  Wrapping key → AES-KW(master_key)
```

**Key properties:**
- Secret derived on-device, never stored anywhere
- Same salt + same authenticator = same secret (deterministic)
- 32 bytes = maximum entropy (256 bits), not limited by human password quality
- USB transport is encrypted (ECDH shared secret between host and authenticator)

**Desktop app specifics:**
- PaddockControl is a Wails desktop app, not a web app
- Uses `libfido2` at CTAP level (not browser WebAuthn API)
- `rpId = "paddockcontrol.local"` (self-contained, no remote server)
- Pure Go option: `github.com/AhmedLotfy02/go-libfido2` avoids CGo

**Compatible hardware:** Any FIDO2 CTAP2.1+ key (YubiKey 5, SoloKeys v2, Nitrokey 3, Google Titan, etc.)

**Precedent:**
- **Bitwarden**: Uses WebAuthn PRF (the browser-side equivalent of hmac-secret) to derive vault encryption key, eliminating master password
- **KeePassXC**: Actively migrating from YubiKey-proprietary HMAC-SHA1 to FIDO2 hmac-secret for the same reason
- **systemd-cryptenroll**: Uses FIDO2 hmac-secret for LUKS disk encryption key derivation

---

## Method Dropped & Rationale

### Method 4: YubiKey PIV (RSA-2048) — DROPPED

**Method 3 (FIDO2 hmac-secret) makes Method 4 redundant.** Here is the detailed comparison:

| Criteria | M3: FIDO2 hmac-secret | M4: PIV RSA-2048 |
|---|---|---|
| **USB transport** | Encrypted (ECDH) | Cleartext (PIN included) |
| **CGo required** | No (pure Go possible) | Yes on Linux |
| **Device compatibility** | Any FIDO2 key | YubiKey only (PIV is proprietary) |
| **Standard** | FIDO Alliance (open) | NIST SP 800-73 (government) |
| **Ecosystem adoption** | Bitwarden, KeePassXC, systemd | Government/enterprise only |
| **Complexity** | Medium | High (slots, PIN/PUK, certs) |
| **PIN lockout** | Yes (CTAP2.1 `minPinLength`) | Yes (3 attempts) |
| **Key never exported** | Yes | Yes |

**The only theoretical advantage of PIV** — PIN lockout after 3 failures — is also available in CTAP2.1 via PIN enforcement. Meanwhile, PIV has a critical weakness: the PIN and wrapped key transit USB in cleartext (no ECDH), making it vulnerable to USB sniffing.

**CGo is a strong architectural constraint** for PaddockControl/Wails builds. M3 avoids it entirely; M4 requires it on Linux.

---

## Phase 1 — Foundation: Master Key + Argon2id

**Goal:** Refactor the encryption architecture without adding new external dependencies.

### 1.1 Database Migration (`000004_security_keys.up.sql`)

```sql
CREATE TABLE security_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    method TEXT NOT NULL CHECK(method IN ('password', 'os_native', 'fido2')),
    label TEXT NOT NULL,           -- user-facing name ("My Password", "This PC", "YubiKey 5")
    wrapped_master_key BLOB NOT NULL, -- master key encrypted by this method's derived key
    metadata TEXT,                 -- JSON: method-specific data (salt, credential_id, etc.)
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_used_at INTEGER
);

CREATE INDEX idx_security_keys_method ON security_keys(method);
```

**`metadata` JSON per method:**

```jsonc
// M1: password
{ "salt": "<base64>", "argon2_memory": 65536, "argon2_iterations": 3, "argon2_parallelism": 4 }

// M2: os_native
{ "platform": "windows|linux", "keyring_service": "paddockcontrol", "keyring_account": "<username>" }

// M3: fido2
{ "credential_id": "<base64>", "salt": "<base64>", "rp_id": "paddockcontrol.local", "aaguid": "<hex>" }
```

### 1.2 Master Key Generation

```go
// internal/crypto/masterkey.go

func GenerateMasterKey() ([]byte, error) {
    key := make([]byte, 32)
    if _, err := rand.Read(key); err != nil {
        return nil, fmt.Errorf("failed to generate master key: %w", err)
    }
    return key, nil
}
```

### 1.3 Key Wrapping (AES-KW or AES-GCM)

```go
// internal/crypto/wrap.go

// WrapMasterKey encrypts the master key with a method-derived wrapping key
func WrapMasterKey(masterKey, wrappingKey []byte) ([]byte, error) {
    // AES-256-GCM wrap (same pattern as current encrypt, but for 32-byte payloads)
}

// UnwrapMasterKey decrypts the master key with a method-derived wrapping key
func UnwrapMasterKey(wrappedKey, wrappingKey []byte) ([]byte, error) {
    // AES-256-GCM unwrap
}
```

### 1.4 Argon2id Key Derivation

```go
// internal/crypto/kdf.go

func DeriveKeyFromPassword(password string, salt []byte) []byte {
    return argon2.IDKey(
        []byte(password),
        salt,
        3,          // iterations
        64*1024,    // 64 MiB memory
        4,          // parallelism
        32,         // key length
    )
}
```

### 1.5 Migration Path (Existing Data)

On first launch after update:
1. Detect old format: no `security_keys` table, encrypted keys use SHA-256
2. Prompt user for their existing password
3. Decrypt all keys with old method (`SHA-256(password)`)
4. Generate new master key
5. Re-encrypt all keys with master key
6. Create M1 entry: `Argon2id(password, new_salt)` → wrap master key
7. Store in `security_keys`
8. Atomic transaction: update all certificates + insert security key entry

### 1.6 Backend API Changes

**Modified methods:**
- `ProvideEncryptionKey(password)` → looks up M1 entry, derives key with Argon2id, unwraps master key
- `ChangeEncryptionKey(oldPassword, newPassword)` → re-wraps master key only (no cert re-encryption)
- `ClearEncryptionKey()` → unchanged (zeros master key from memory)

**New methods:**
- `ListSecurityKeys() []SecurityKeyInfo` — list enrolled methods (id, method, label, created_at, last_used_at)
- `RemoveSecurityKey(id)` — remove a method (prevent removing last password method)
- `EnrollPasswordMethod(password, label)` — add another password wrapping
- `UnlockWithMethod(methodId, credentials)` — generic unlock dispatcher

**Modified `encrypt.go`:**
- `EncryptPrivateKey(pemData, masterKey []byte)` — accepts `[]byte` instead of `string`
- `DecryptPrivateKey(encryptedData, masterKey []byte)` — accepts `[]byte` instead of `string`
- Remove internal `SHA-256` derivation (caller provides raw key)

### 1.7 Files Created/Modified

| File | Action | Description |
|---|---|---|
| `internal/crypto/masterkey.go` | Create | Master key generation |
| `internal/crypto/wrap.go` | Create | AES key wrapping/unwrapping |
| `internal/crypto/kdf.go` | Create | Argon2id key derivation |
| `internal/crypto/encrypt.go` | Modify | Accept `[]byte` key instead of `string` |
| `internal/db/migrations/000004_security_keys.up.sql` | Create | New table |
| `internal/db/migrations/000004_security_keys.down.sql` | Create | Drop table |
| `internal/db/schema.sql` | Modify | Add security_keys table |
| `internal/db/queries/security_keys.sql` | Create | sqlc queries |
| `internal/models/security_key.go` | Create | Go structs |
| `app_encryption_key.go` | Modify | Use master key wrapping |
| `app_security_keys.go` | Create | New bound methods |

---

## Phase 2 — Convenience: OS-Native Protection

**Goal:** "Remember me on this computer" — persist master key across sessions.

### 2.1 OS Abstraction Layer

```go
// internal/keystore/keystore.go

type Keystore interface {
    Store(service, account string, data []byte) error
    Retrieve(service, account string) ([]byte, error)
    Delete(service, account string) error
    Available() bool
}
```

### 2.2 Platform Implementations

**Windows (DPAPI):**
```go
// internal/keystore/keystore_windows.go
// Uses syscall to CryptProtectData/CryptUnprotectData
// No CGo — direct Win32 API via syscall
```

**Linux (Secret Service / D-Bus):**
```go
// internal/keystore/keystore_linux.go
// Uses go-keyring (pure Go D-Bus client)
// Works with GNOME Keyring, KWallet, KeePassXC Secret Service
```

### 2.3 Enrollment Flow

1. User unlocks with M1 (password)
2. User checks "Remember me on this computer"
3. Backend calls `Keystore.Store("paddockcontrol", username, wrappingKey)`
4. Create `security_keys` entry with `method = "os_native"`
5. On next launch: try `Keystore.Retrieve()` → unwrap master key → auto-unlock

### 2.4 Files Created

| File | Action |
|---|---|
| `internal/keystore/keystore.go` | Interface |
| `internal/keystore/keystore_windows.go` | DPAPI implementation |
| `internal/keystore/keystore_linux.go` | Secret Service implementation |
| `app_security_keys.go` | Add `EnrollOSNative()`, `UnlockWithOSNative()` |

### 2.5 Dependencies

- `github.com/zalando/go-keyring` — pure Go, no CGo, MIT license
- No additional build constraints

---

## Phase 3 — Hardware: FIDO2 hmac-secret

**Goal:** Hardware-bound key derivation using any FIDO2 security key.

### 3.1 FIDO2 Abstraction

```go
// internal/fido2/fido2.go

type Authenticator interface {
    // Register creates a new credential and returns credential_id + initial hmac-secret
    Register(rpId string, userId []byte, salt []byte) (credentialId []byte, secret []byte, err error)

    // Authenticate derives hmac-secret from existing credential
    Authenticate(rpId string, credentialId []byte, salt []byte) (secret []byte, err error)

    // ListDevices returns connected FIDO2 authenticators
    ListDevices() ([]DeviceInfo, error)
}
```

### 3.2 Key Derivation from hmac-secret

```go
func DeriveWrappingKeyFromFIDO2(hmacSecret []byte) []byte {
    // HKDF-SHA-256 to derive a proper wrapping key
    hkdf := hkdf.New(sha256.New, hmacSecret, nil, []byte("paddockcontrol-master-key-wrap-v1"))
    key := make([]byte, 32)
    io.ReadFull(hkdf, key)
    return key
}
```

### 3.3 Enrollment Flow

1. User unlocks with existing method (M1 or M2)
2. User clicks "Add Security Key"
3. App prompts: "Insert your FIDO2 key and touch it"
4. `Register()` → creates credential on device, derives hmac-secret
5. `HKDF(hmac-secret)` → wrapping key → wrap master key
6. Store `credential_id` + `salt` in `security_keys.metadata`
7. Create `security_keys` entry with `method = "fido2"`

### 3.4 Unlock Flow

1. App detects enrolled FIDO2 method in `security_keys`
2. Prompts: "Touch your security key"
3. `Authenticate(rpId, credentialId, salt)` → hmac-secret
4. `HKDF(hmac-secret)` → wrapping key → unwrap master key
5. Master key decrypts certificates

### 3.5 Go Library Evaluation

| Library | CGo | Status | Notes |
|---|---|---|---|
| `github.com/AhmedLotfy02/go-libfido2` | No | Active | Pure Go, CTAP2.1 |
| `github.com/AhmedLotfy02/go-fido2` | No | Active | Fork with hmac-secret |
| `github.com/AhmedLotfy02/go-fido2` | No | Active | USB HID direct |
| `github.com/AhmedLotfy02/go-libfido2` | Yes | Mature | Wraps C libfido2 |

Decision to be finalized at Phase 3 start based on library maturity. The priority is **pure Go** to maintain the current zero-CGo build.

### 3.6 Files Created

| File | Action |
|---|---|
| `internal/fido2/fido2.go` | Interface |
| `internal/fido2/fido2_impl.go` | Implementation (USB HID) |
| `internal/crypto/kdf.go` | Add `DeriveKeyFromFIDO2()` |
| `app_security_keys.go` | Add `EnrollFIDO2()`, `UnlockWithFIDO2()`, `ListFIDO2Devices()` |

---

## Database Migration

### New table: `security_keys`

```sql
-- 000004_security_keys.up.sql
CREATE TABLE security_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    method TEXT NOT NULL CHECK(method IN ('password', 'os_native', 'fido2')),
    label TEXT NOT NULL,
    wrapped_master_key BLOB NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_used_at INTEGER
);

CREATE INDEX idx_security_keys_method ON security_keys(method);
```

```sql
-- 000004_security_keys.down.sql
DROP INDEX IF EXISTS idx_security_keys_method;
DROP TABLE IF EXISTS security_keys;
```

### sqlc queries (`internal/db/queries/security_keys.sql`)

```sql
-- name: ListSecurityKeys :many
SELECT id, method, label, created_at, last_used_at FROM security_keys ORDER BY created_at;

-- name: GetSecurityKeysByMethod :many
SELECT * FROM security_keys WHERE method = ? ORDER BY created_at;

-- name: GetSecurityKeyByID :one
SELECT * FROM security_keys WHERE id = ?;

-- name: InsertSecurityKey :one
INSERT INTO security_keys (method, label, wrapped_master_key, metadata)
VALUES (?, ?, ?, ?) RETURNING *;

-- name: UpdateLastUsed :exec
UPDATE security_keys SET last_used_at = unixepoch() WHERE id = ?;

-- name: DeleteSecurityKey :exec
DELETE FROM security_keys WHERE id = ?;

-- name: CountSecurityKeysByMethod :one
SELECT COUNT(*) FROM security_keys WHERE method = ?;
```

---

## Frontend Changes

### Unlock Dialog Redesign

The current `EncryptionKeyDialog.tsx` becomes a multi-method unlock screen:

```
┌─────────────────────────────────────────┐
│          Unlock PaddockControl          │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Enter password                 │    │
│  └─────────────────────────────────┘    │
│  [ ] Remember me on this computer       │
│                                         │
│  ─────── or ───────                     │
│                                         │
│  [ Use Security Key ]                   │
│                                         │
│           [Unlock]                      │
└─────────────────────────────────────────┘
```

### Settings: Security Keys Management

New section in Settings page:

```
Security Keys
─────────────────────────────────────
  Password "Main password"      [Remove]
  This PC  "Windows login"      [Remove]
  FIDO2    "YubiKey 5 NFC"      [Remove]

  [+ Add Method]
```

### New Frontend Files

| File | Description |
|---|---|
| `src/components/security/UnlockDialog.tsx` | Multi-method unlock |
| `src/components/security/SecurityKeysList.tsx` | Settings management |
| `src/components/security/EnrollFIDO2Dialog.tsx` | FIDO2 enrollment wizard |
| `src/stores/useSecurityStore.ts` | Security keys state |

---

## Risk Mitigation

### Key Loss Scenario

> "Forget password + lose all hardware keys = all private keys irrecoverable"

**Mitigations:**
1. **M1 (password) is mandatory** — cannot be fully removed, at least one password method must exist
2. **Enrollment guard** — UI warns when only one method is enrolled
3. **Encrypted backup export** — existing backup system already handles this
4. **Recovery phrase** (future consideration) — BIP-39 mnemonic encoding of master key

### Migration Safety

- Phase 1 migration is wrapped in a single SQLite transaction
- If migration fails, old format remains intact
- `ChangeEncryptionKey` in new architecture only re-wraps (no cert re-encryption), drastically reducing blast radius

### FIDO2 Key Loss

- FIDO2 is always an **additional** method, never the only one
- Removing a FIDO2 key only deletes the wrapping entry; master key and data are unaffected
- UI enforces: "You must have at least one password method enrolled"

---

## Sources & References

### Standards & Specifications
- [W3C WebAuthn PRF Extension Explainer](https://github.com/w3c/webauthn/wiki/Explainer:-PRF-extension)
- [FIDO2 CTAP2.1 Specification — Yubico](https://developers.yubico.com/CTAP/CTAP2.1.html)
- [FIDO2 hmac-secret Extension — Yubico SDK](https://docs.yubico.com/yesdk/users-manual/application-fido2/hmac-secret.html)
- [CTAP2 HMAC Secret Deep Dive — Yubico](https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/CTAP2_HMAC_Secret_Deep_Dive.html)
- [Developer's Guide to PRF — Yubico](https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/Developers_Guide_to_PRF.html)

### Industry Implementations (Validation)
- [Bitwarden: PRF WebAuthn and its role in passkeys](https://bitwarden.com/blog/prf-webauthn-and-its-role-in-passkeys/) — Bitwarden uses the exact same pattern (PRF/hmac-secret → vault key derivation)
- [KeePassXC: FIDO2 hmac-secret Discussion #9506](https://github.com/keepassxreboot/keepassxc/discussions/9506) — KeePassXC migrating from proprietary HMAC-SHA1 to FIDO2 hmac-secret
- [Confer: E2E Encrypted AI Chat with Passkeys](https://confer.to/blog/2025/12/passkey-encryption/) — PRF for client-side encryption without server knowledge
- [systemd-cryptenroll](https://www.freedesktop.org/software/systemd/man/latest/systemd-cryptenroll.html) — FIDO2 hmac-secret for LUKS disk encryption

### Platform Support
- [Passkeys & WebAuthn PRF for E2E Encryption — Corbado](https://www.corbado.com/blog/passkeys-prf-webauthn) — PRF platform support matrix (2026)
- [FIDO Alliance CXF/CXP Specifications](https://fidoalliance.org/fido-alliance-publishes-new-specifications-to-promote-user-choice-and-enhanced-ux-for-passkeys/) — Credential portability including PRF data

### Yubico Security Functions
- [YubiKey Compare — Yubico Store](https://www.yubico.com/fr/store/compare/) — Full comparison of supported protocols
- [PIV Smart Card — Yubico](https://developers.yubico.com/PIV/Introduction/YubiKey_and_PIV.html) — PIV slot architecture
- [Yubico OTP Explained](https://developers.yubico.com/OTP/OTPs_Explained.html) — OTP protocol details
- [CTAP Overview — Yubico](https://developers.yubico.com/CTAP/) — CTAP1/2/2.1 comparison

### Why PIV Was Dropped
- PIV USB transport sends PIN in cleartext (no ECDH), unlike FIDO2
- PIV requires CGo on Linux (`libykpiv`)
- PIV is YubiKey-specific; FIDO2 works with any compliant key
- CTAP2.1 provides equivalent PIN lockout via `minPinLength` enforcement
