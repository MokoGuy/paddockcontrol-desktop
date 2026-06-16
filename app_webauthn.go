package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"
	"paddockcontrol-desktop/internal/webauthn"
)

// webAuthnRPID identifies this app to the platform WebAuthn API. For a native
// app (not a browser) this is just a stable relying-party id, not a domain that
// must resolve.
const webAuthnRPID = "paddockcontrol.local"

// webAuthnSalt is the fixed PRF/hmac-secret salt shared by every passkey. A
// single salt lets unlock offer all credentials in one assertion (the user picks
// the authenticator at the OS dialog). It need not be secret: each credential's
// secret is HMAC(credRandom, salt), and credRandom is unique per credential. Must
// be exactly 32 bytes.
var webAuthnSalt = []byte("paddockcontrol/passkey-prf/salt1")

// appWindowTitle (the native window title used to parent the WebAuthn dialog) is
// defined once in main.go alongside the Wails window Title.

// IsWebAuthnAvailable reports whether platform WebAuthn (Windows Hello / security
// keys) is usable on this OS.
func (a *App) IsWebAuthnAvailable() bool {
	return webauthn.Available()
}

// EnrollPasskey enrolls a passkey as an unlock method. The OS dialog lets the
// user pick Windows Hello, a security key, or a phone; the resulting method is
// labelled from the authenticator that was used. Requires the app unlocked.
func (a *App) EnrollPasskey() error {
	if err := a.requireUnlocked(); err != nil {
		return fmt.Errorf("app must be unlocked: %w", err)
	}
	if !webauthn.Available() {
		return fmt.Errorf("passkey unlock is not available on this platform")
	}

	a.mu.RLock()
	masterKey := make([]byte, len(a.masterKey))
	copy(masterKey, a.masterKey)
	database := a.db
	a.mu.RUnlock()
	defer crypto.Zero(masterKey)

	if len(masterKey) != 32 {
		return fmt.Errorf("master key is not available")
	}

	log := logger.WithComponent("app")
	log.Info("enrolling passkey (WebAuthn) unlock method")

	// All passkeys share webAuthnSalt so unlock can offer them in one assertion.
	salt := webAuthnSalt

	// Exclude already-enrolled passkeys so the same authenticator can't register a
	// duplicate (which, for Windows Hello, would overwrite the existing one).
	exclude := a.enrolledPasskeyCredentialIDs()
	log.Debug("starting passkey enrollment", slog.Int("excluded_credentials", len(exclude)))

	cred, err := webauthn.Enroll(appWindowTitle, webAuthnRPID, "PaddockControl", "paddock", salt, exclude)
	if err != nil {
		log.Info("passkey enrollment did not complete", logger.Err(err))
		if errors.Is(err, webauthn.ErrCredentialAlreadyEnrolled) {
			return fmt.Errorf("this authenticator already has a passkey here; use a different device or security key")
		}
		if errors.Is(err, webauthn.ErrPlatformAuthenticatorUnsupported) {
			return fmt.Errorf("Windows Hello can't store a passkey on this device (it isn't backed by a TPM here); use a security key instead")
		}
		return fmt.Errorf("passkey enrollment failed: %w", err)
	}
	defer crypto.Zero(cred.Secret)

	wrappedMasterKey, err := crypto.WrapMasterKey(masterKey, cred.Secret)
	if err != nil {
		return fmt.Errorf("failed to wrap master key: %w", err)
	}

	metaJSON, err := json.Marshal(models.WebAuthnMetadata{
		CredentialID: cred.CredentialID,
		Salt:         salt,
		Transports:   cred.Transports,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	if err := database.WithTx(a.ctx, func(q *sqlc.Queries) error {
		_, e := q.InsertSecurityKey(a.ctx, sqlc.InsertSecurityKeyParams{
			Method:           models.SecurityKeyMethodFIDO2,
			Label:            webauthn.LabelForTransports(cred.Transports),
			WrappedMasterKey: wrappedMasterKey,
			Metadata:         sql.NullString{String: string(metaJSON), Valid: true},
		})
		return e
	}); err != nil {
		return fmt.Errorf("failed to store security key: %w", err)
	}

	logger.Audit("unlock_method.passkey_enrolled",
		slog.String("label", webauthn.LabelForTransports(cred.Transports)),
		slog.Any("transports", cred.Transports),
	)
	return nil
}

// enrolledPasskeyCredentialIDs returns the credential ids of all enrolled
// passkeys, used as a MakeCredential exclude list to block duplicate enrollment.
func (a *App) enrolledPasskeyCredentialIDs() [][]byte {
	a.mu.RLock()
	database := a.db
	a.mu.RUnlock()
	if database == nil {
		return nil
	}
	keys, err := database.Queries().GetSecurityKeysByMethod(a.ctx, models.SecurityKeyMethodFIDO2)
	if err != nil {
		return nil
	}
	var ids [][]byte
	for _, k := range keys {
		if !k.Metadata.Valid {
			continue
		}
		var meta models.WebAuthnMetadata
		if json.Unmarshal([]byte(k.Metadata.String), &meta) == nil && len(meta.CredentialID) > 0 {
			ids = append(ids, meta.CredentialID)
		}
	}
	return ids
}

// UnlockWithWebAuthn unlocks the app by deriving a passkey's PRF secret and
// unwrapping the master key. The platform shows the Hello / security-key prompt.
// Returns true on success. Unlike OS-keyring auto-unlock this is user-initiated.
func (a *App) UnlockWithWebAuthn() (bool, error) {
	a.mu.RLock()
	database := a.db
	alreadyUnlocked := a.isUnlocked
	a.mu.RUnlock()

	if alreadyUnlocked {
		return true, nil
	}
	if database == nil {
		return false, fmt.Errorf("database not initialized")
	}
	if !webauthn.Available() {
		return false, fmt.Errorf("passkey unlock is not available on this platform")
	}

	log := logger.WithComponent("app")

	keys, err := database.Queries().GetSecurityKeysByMethod(a.ctx, models.SecurityKeyMethodFIDO2)
	if err != nil {
		return false, fmt.Errorf("failed to read passkey methods: %w", err)
	}

	// Offer every enrolled passkey in a single assertion so the OS shows one
	// chooser and the user picks which authenticator to use.
	type candidate struct {
		id      int64
		wrapped []byte
		label   string
	}
	byCredID := make(map[string]candidate)
	var allowed []webauthn.AllowedCredential
	for _, key := range keys {
		if !key.Metadata.Valid {
			continue
		}
		var meta models.WebAuthnMetadata
		if json.Unmarshal([]byte(key.Metadata.String), &meta) != nil || len(meta.CredentialID) == 0 {
			continue
		}
		allowed = append(allowed, webauthn.AllowedCredential{
			CredentialID: meta.CredentialID,
			Transports:   meta.Transports,
		})
		byCredID[string(meta.CredentialID)] = candidate{key.ID, key.WrappedMasterKey, key.Label}
	}
	if len(allowed) == 0 {
		return false, fmt.Errorf("no passkey unlock method is enrolled")
	}

	credID, secret, err := webauthn.Assert(appWindowTitle, webAuthnRPID, allowed, webAuthnSalt)
	if err != nil {
		log.Debug("passkey assertion failed", logger.Err(err))
		logger.Audit("unlock.passkey_failed", slog.Int("candidate_keys", len(allowed)))
		return false, fmt.Errorf("passkey unlock failed: %w", err)
	}
	defer crypto.Zero(secret)

	cand, ok := byCredID[string(credID)]
	if !ok {
		return false, fmt.Errorf("the chosen passkey is not one of the enrolled methods")
	}
	masterKey, uerr := crypto.UnwrapMasterKey(cand.wrapped, secret)
	if uerr != nil {
		return false, fmt.Errorf("failed to unwrap master key: %w", uerr)
	}

	_ = database.Queries().UpdateSecurityKeyLastUsed(a.ctx, cand.id)
	a.finalizeUnlock(masterKey)
	logger.Audit("unlock.passkey_succeeded", slog.Int64("key_id", cand.id), slog.String("label", cand.label))
	return true, nil
}
