//go:build windows

// Spike probe for issue #92: validate that the native Windows WebAuthn API (via
// go-ctap/winhello, CGO-free) can derive a stable PRF/hmac-secret secret from a
// passkey and use it to envelope-encrypt the app's master key.
//
// It tests the TWO authenticator paths the app offers, each with the residency
// Windows actually requires:
//
//	winhello-prf.exe          # Windows Hello: platform authenticator, RESIDENT
//	                          #   webauthn.dll requires resident creds for
//	                          #   hmac-secret on Hello (libfido2 #731)
//	winhello-prf.exe key      # Security key (YubiKey): cross-platform, NON-resident
//	winhello-prf.exe cleanup  # delete the spike's resident credential(s) + state
//
// PRF is EVALUATED at create() (pPRFGlobalEval). The generic CTAP guidance is to
// enable-only and derive at get(), but Windows Hello / NGC rejects the
// enable-only path with NTE_NOT_SUPPORTED (0x80090029) and falls back to the
// device chooser — observed in the Microsoft-Windows-WebAuthN/Operational ETW log.
// The credential id + salt still re-derive the same secret at get() afterwards.
//
// Build (from WSL/Linux, no CGO):
//
//	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o winhello-prf.exe .
package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"time"
	"unsafe"

	"github.com/go-ctap/ctaphid/pkg/webauthntypes"
	"github.com/go-ctap/winhello"
	"github.com/go-ctap/winhello/hiddenwindow"
	"github.com/ldclabs/cose/iana"
	"golang.org/x/sys/windows"
)

const (
	rpID   = "paddockcontrol.local"
	rpName = "PaddockControl"
)

// prfSalt is the fixed salt the app uses to derive the wrapping key. The raw
// hmac-secret extension requires EXACTLY 32 bytes (the PRF path tolerated other
// lengths; raw does not — 33 bytes returned ERROR_INVALID_DATA).
var prfSalt = []byte("paddockcontrol/master-key/wrapv1") // 32 bytes

// path is one authenticator configuration under test. The residency is the key
// variable: Windows Hello needs resident/discoverable credentials for hmac-secret,
// while a roaming security key uses non-resident so it consumes no on-key slot.
type path struct {
	name       string
	attachment winhello.WinHelloAuthenticatorAttachment
	resident   bool
	hint       webauthntypes.PublicKeyCredentialHint
	stateFile  string
}

var (
	helloPath = path{
		name:       "Windows Hello (platform, resident)",
		attachment: winhello.WinHelloAuthenticatorAttachmentPlatform,
		resident:   true,
		hint:       webauthntypes.PublicKeyCredentialHintClientDevice,
		stateFile:  "winhello-prf.credid.platform",
	}
	keyPath = path{
		name:       "security key (cross-platform, non-resident)",
		attachment: winhello.WinHelloAuthenticatorAttachmentCrossPlatform,
		resident:   false,
		hint:       webauthntypes.PublicKeyCredentialHintSecurityKey,
		stateFile:  "winhello-prf.credid.key",
	}
)

// noPRF, when set via the "noprf" arg, creates a plain passkey with NO hmac-secret
// extension — to confirm that a software Windows Hello key CAN create a normal
// credential but NOT an hmac-secret one (the 0x80090029 NOT_SUPPORTED case).
var noPRF = false

func main() {
	p := helloPath
	cleanup := false
	nonResident := false
	for _, a := range os.Args[1:] {
		switch a {
		case "key":
			p = keyPath
		case "nonres": // force non-resident — to test if Hello works without a resident key
			nonResident = true
		case "noprf":
			noPRF = true
		case "tpm": // detection probe only — no UI, no credential
			probePlatformCrypto()
			return
		case "cleanup":
			cleanup = true
		default:
			fail("unknown argument %q (use: [key] [nonres] [noprf] [tpm] [cleanup])", a)
		}
	}
	if nonResident {
		p.resident = false
		p.name += " [forced non-resident]"
	}

	logf("path: %s | hint=%s | resident=%v", p.name, p.hint, p.resident)
	strategy := "evaluate at create (pPRFGlobalEval) — required by Windows Hello/NGC"
	if noPRF {
		strategy = "NONE — plain passkey, no hmac-secret (isolation test)"
	}
	logf("PRF strategy: %s", strategy)
	logf(">>> WATCH the Windows dialog: a 'phone / security key' chooser, or straight to the authenticator? <<<")

	wnd, err := hiddenwindow.New(slog.New(slog.DiscardHandler), "PaddockControl PRF Spike")
	if err != nil {
		fail("create hidden window: %v", err)
	}
	defer wnd.Close()
	hWnd := wnd.WindowHandle()

	fmt.Printf("[INFO] Windows WebAuthn API version: %d\n", winhello.APIVersionNumber())
	avail, err := winhello.IsUserVerifyingPlatformAuthenticatorAvailable()
	fmt.Printf("[INFO] Windows Hello platform authenticator available: %v (err=%v)\n", avail, err)

	if cleanup {
		doCleanup()
		return
	}

	credID, fresh := ensureCredential(hWnd, p)
	fmt.Printf("[INFO] credential id (%d bytes): %s\n", len(credID), base64.URLEncoding.EncodeToString(credID))
	if fresh {
		fmt.Println("[INFO] created a NEW credential — run again to prove cross-restart re-derivation")
	} else {
		fmt.Println("[PASS] reused an existing credential from a previous process (cross-restart path)")
	}

	if noPRF {
		fmt.Printf("\n=== RESULT: a plain (no-hmac-secret) credential was created on %s. ===\n", p.name)
		fmt.Println("If THIS works but the PRF run fails with NGC 0x80090029, the limitation is hmac-secret")
		fmt.Println("on a software (non-TPM) Windows Hello key — not our code.")
		return
	}

	// PRF must be deterministic for a fixed (credential, salt): a stable KEK. Two
	// independent assertions must yield the same 32 bytes.
	secretA := derivePRF(hWnd, p, credID, prfSalt)
	secretB := derivePRF(hWnd, p, credID, prfSalt)
	fmt.Printf("[INFO] PRF secret (32B expected, got %d): %s\n", len(secretA), hex.EncodeToString(secretA))
	if len(secretA) != 32 {
		fail("PRF output is %d bytes, expected 32", len(secretA))
	}
	if !bytes.Equal(secretA, secretB) {
		fail("PRF secret is NOT deterministic — cannot be a stable wrapping key")
	}
	fmt.Println("[PASS] PRF secret is deterministic for a fixed (credential, salt)")

	// Envelope round-trip: wrap a dummy master key with the PRF KEK, then unwrap
	// with the independently re-derived secret.
	masterKey := make([]byte, 32)
	_, _ = rand.Read(masterKey)
	wrapped, err := aesGCMSeal(secretA, masterKey)
	if err != nil {
		fail("wrap master key: %v", err)
	}
	unwrapped, err := aesGCMOpen(secretB, wrapped)
	if err != nil {
		fail("unwrap master key: %v", err)
	}
	if !bytes.Equal(masterKey, unwrapped) {
		fail("unwrapped master key does not match the original")
	}
	fmt.Println("[PASS] envelope round-trip: master key wrapped with the PRF KEK and recovered")

	fmt.Printf("\n=== RESULT: %s PRF envelope works on this machine. ===\n", p.name)
	fmt.Println("Run `winhello-prf.exe cleanup` to remove the spike credential(s).")
}

// ensureCredential returns a persisted credential id, or creates a fresh one. The
// credential enables hmac-secret/PRF at creation but does not evaluate it.
func ensureCredential(hWnd windows.HWND, p path) (credID []byte, fresh bool) {
	if data, err := os.ReadFile(statePath(p.stateFile)); err == nil {
		if id, derr := base64.URLEncoding.DecodeString(string(bytes.TrimSpace(data))); derr == nil && len(id) > 0 {
			return id, false
		}
	}

	logf("calling MakeCredential (attachment=%d resident=%v prf=%v)...", p.attachment, p.resident, !noPRF)
	resp, err := winhello.MakeCredential(
		hWnd,
		[]byte("{}"),
		webauthntypes.PublicKeyCredentialRpEntity{ID: rpID, Name: rpName},
		webauthntypes.PublicKeyCredentialUserEntity{ID: []byte("paddock-user"), Name: "paddock", DisplayName: rpName},
		[]webauthntypes.PublicKeyCredentialParameters{
			{Type: webauthntypes.PublicKeyCredentialTypePublicKey, Algorithm: iana.AlgorithmES256},
		},
		nil,
		createExt(),
		&winhello.AuthenticatorMakeCredentialOptions{
			AuthenticatorAttachment:     p.attachment,
			UserVerificationRequirement: winhello.WinHelloUserVerificationRequirementRequired,
			RequireResidentKey:          p.resident,
			CredentialHints:             []webauthntypes.PublicKeyCredentialHint{p.hint},
		},
	)
	logf("MakeCredential returned (err=%v)", err)
	if err != nil {
		fail("MakeCredential: %v", err)
	}
	hmacLen := 0
	if resp.HMACSecret != nil {
		hmacLen = len(resp.HMACSecret.First)
	}
	fmt.Printf("[INFO] MakeCredential OK; PRFEnabled=%v usedTransport=%v residentKey=%v hmac_at_create=%dB\n",
		resp.PRFEnabled, resp.UsedTransport, resp.ResidentKey, hmacLen)
	if hmacLen == 32 {
		logf("PRF secret returned AT CREATION → enrollment can be a single ceremony")
	}
	if !resp.PRFEnabled {
		fmt.Println("[WARN] PRFEnabled=false on create — the get() below is the real test of PRF support")
	}
	if err := os.WriteFile(statePath(p.stateFile), []byte(base64.URLEncoding.EncodeToString(resp.CredentialID)), 0o600); err != nil {
		fmt.Printf("[WARN] could not persist credential id: %v\n", err)
	}
	return resp.CredentialID, true
}

// derivePRF evaluates the PRF for (credID, salt) via a get() assertion, routed to
// the credential's authenticator class so Windows skips the device chooser.
func derivePRF(hWnd windows.HWND, p path, credID, salt []byte) []byte {
	descriptor := webauthntypes.PublicKeyCredentialDescriptor{
		ID:   credID,
		Type: webauthntypes.PublicKeyCredentialTypePublicKey,
	}
	if p.attachment == winhello.WinHelloAuthenticatorAttachmentPlatform {
		descriptor.Transports = []webauthntypes.AuthenticatorTransport{
			webauthntypes.AuthenticatorTransportInternal,
		}
	}

	logf("calling GetAssertion (derive PRF, attachment=%d)...", p.attachment)
	assertion, err := winhello.GetAssertion(
		hWnd,
		rpID,
		[]byte("{}"),
		[]webauthntypes.PublicKeyCredentialDescriptor{descriptor},
		&webauthntypes.GetAuthenticationExtensionsClientInputs{
			// Raw hmac-secret, NOT PRFInputs: winhello sets the required
			// WEBAUTHN_AUTHENTICATOR_HMAC_SECRET_VALUES_FLAG only on this path, so
			// Windows actually evaluates the salt at get(). winhello passes the salt
			// straight through (no PRF pre-hash), so Output1 == the create-time secret.
			GetHMACSecretInputs: &webauthntypes.GetHMACSecretInputs{
				HMACGetSecret: webauthntypes.HMACGetSecretInput{Salt1: salt},
			},
		},
		&winhello.AuthenticatorGetAssertionOptions{
			AuthenticatorAttachment:     p.attachment,
			UserVerificationRequirement: winhello.WinHelloUserVerificationRequirementRequired,
		},
	)
	if err != nil {
		fail("GetAssertion: %v", err)
	}
	out := assertion.ExtensionOutputs
	if out == nil || out.GetHMACSecretOutputs == nil {
		fail("assertion returned no hmac-secret output (ExtensionOutputs nil=%v) — salt not evaluated", out == nil)
	}
	secret := out.GetHMACSecretOutputs.HMACGetSecret.Output1
	logf("GetAssertion OK; hmac-secret output len=%d", len(secret))
	return secret
}

// doCleanup deletes the resident Windows Hello credentials this spike created
// (found by rpID, robust even if the state files are gone) and the state files.
func doCleanup() {
	creds, err := winhello.PlatformCredentialList(rpID, false)
	if err != nil {
		fmt.Printf("[WARN] PlatformCredentialList: %v\n", err)
	}
	removed := 0
	for _, c := range creds {
		if c.RP.ID != rpID {
			continue
		}
		if derr := winhello.DeletePlatformCredential(c.CredentialID); derr != nil {
			fmt.Printf("[WARN] delete %x: %v\n", c.CredentialID, derr)
			continue
		}
		removed++
	}
	fmt.Printf("[INFO] removed %d Windows Hello credential(s) for %q\n", removed, rpID)

	_ = os.Remove(statePath(helloPath.stateFile))
	_ = os.Remove(statePath(keyPath.stateFile))
	fmt.Println("[NOTE] a credential created on a SECURITY KEY (YubiKey) lives on the key itself and")
	fmt.Println("       cannot be removed from here — use Yubico Authenticator or: ykman fido credentials delete")
	fmt.Println("[INFO] cleanup done")
}

func aesGCMSeal(key, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func aesGCMOpen(key, ct []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	ns := gcm.NonceSize()
	if len(ct) < ns {
		return nil, fmt.Errorf("ciphertext too short")
	}
	return gcm.Open(nil, ct[:ns], ct[ns:], nil)
}

func statePath(name string) string {
	exe, err := os.Executable()
	if err != nil {
		return name
	}
	return filepath.Join(filepath.Dir(exe), name)
}

// createExt returns the create-time extension request: PRF evaluated at creation
// (pPRFGlobalEval), or nil for the "noprf" isolation test. Windows Hello / NGC
// REQUIRES eval-at-create: bEnablePrf-only (CreateHMACSecret) makes NGC return
// NTE_NOT_SUPPORTED (0x80090029), confirmed in the WebAuthN ETW log. (winhello
// v0.1.0 also dereferences PRF.Eval unconditionally on this path.)
func createExt() *webauthntypes.CreateAuthenticationExtensionsClientInputs {
	if noPRF {
		return nil
	}
	return &webauthntypes.CreateAuthenticationExtensionsClientInputs{
		PRFInputs: &webauthntypes.PRFInputs{PRF: webauthntypes.AuthenticationExtensionsPRFInputs{
			Eval: &webauthntypes.AuthenticationExtensionsPRFValues{First: prfSalt},
		}},
	}
}

// probePlatformCrypto tests whether the Microsoft Platform Crypto Provider (the
// TPM-backed CNG key storage provider) can be opened. Windows Hello passkeys need
// a TPM-backed key; if this KSP is unavailable, Hello falls back to software keys
// that cannot store passkeys (NGC MakeCredential → NTE_NOT_SUPPORTED). This is a
// candidate CGO-free pre-flight signal for "Windows Hello passkey is usable here".
func probePlatformCrypto() {
	ncrypt := windows.NewLazySystemDLL("ncrypt.dll")
	open := ncrypt.NewProc("NCryptOpenStorageProvider")
	free := ncrypt.NewProc("NCryptFreeObject")

	name, _ := windows.UTF16PtrFromString("Microsoft Platform Crypto Provider")
	var hProv uintptr
	r, _, _ := open.Call(uintptr(unsafe.Pointer(&hProv)), uintptr(unsafe.Pointer(name)), 0)
	status := uint32(r)
	if status == 0 {
		logf("Platform Crypto Provider (TPM KSP): AVAILABLE (0x0) → TPM-backed keys usable")
		logf(">>> if this says AVAILABLE but Hello passkeys still fail, the KSP is NOT a reliable signal <<<")
		free.Call(hProv)
		return
	}
	logf("Platform Crypto Provider (TPM KSP): UNAVAILABLE (0x%08X) → Windows Hello will use SOFTWARE keys", status)
	logf(">>> if this matches the failing Hello passkey, it IS a usable pre-flight detection signal <<<")
}

// logf prints a timestamped [INFO] line so the console output can be correlated
// with the Microsoft-Windows-WebAuthN/Operational ETW timestamps.
func logf(format string, a ...any) {
	fmt.Printf("[%s] [INFO] "+format+"\n", append([]any{time.Now().Format("15:04:05.000")}, a...)...)
}

func fail(format string, a ...any) {
	fmt.Printf("[%s] [FAIL] "+format+"\n", append([]any{time.Now().Format("15:04:05.000")}, a...)...)
	os.Exit(1)
}
