package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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

	salt := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return fmt.Errorf("failed to generate salt: %w", err)
	}

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
	if len(keys) == 0 {
		return false, fmt.Errorf("no passkey unlock method is enrolled")
	}

	for _, key := range keys {
		if !key.Metadata.Valid {
			continue
		}
		var meta models.WebAuthnMetadata
		if err := json.Unmarshal([]byte(key.Metadata.String), &meta); err != nil {
			continue
		}

		log.Debug("attempting passkey unlock", slog.Int64("key_id", key.ID), slog.String("label", key.Label))

		// The stored transports route the prompt straight to the authenticator
		// that holds this credential (no device chooser).
		secret, err := webauthn.Derive(appWindowTitle, webAuthnRPID, meta.CredentialID, meta.Salt, meta.Transports)
		if err != nil {
			// User cancelled, wrong authenticator, or this credential isn't present.
			log.Debug("passkey derive failed", slog.Int64("key_id", key.ID), logger.Err(err))
			continue
		}
		masterKey, uerr := crypto.UnwrapMasterKey(key.WrappedMasterKey, secret)
		crypto.Zero(secret)
		if uerr != nil {
			log.Debug("passkey master-key unwrap failed", slog.Int64("key_id", key.ID))
			continue
		}

		_ = database.Queries().UpdateSecurityKeyLastUsed(a.ctx, key.ID)
		a.finalizeUnlock(masterKey)
		logger.Audit("unlock.passkey_succeeded", slog.Int64("key_id", key.ID), slog.String("label", key.Label))
		return true, nil
	}

	logger.Audit("unlock.passkey_failed", slog.Int("candidate_keys", len(keys)))
	return false, fmt.Errorf("passkey unlock failed")
}
