package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"

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

// appWindowTitle must match the Wails window Title in main.go — it's used to
// parent the WebAuthn dialog to the app's top-level window.
const appWindowTitle = "paddockcontrol"

// IsWebAuthnAvailable reports whether platform WebAuthn (Windows Hello / security
// keys) is usable on this OS.
func (a *App) IsWebAuthnAvailable() bool {
	return webauthn.Available()
}

// EnrollWebAuthn enrolls a passkey (Windows Hello or a FIDO2 security key) as an
// unlock method. It creates a non-resident credential with PRF, derives a
// wrapping key, and stores the wrapped master key. Requires the app unlocked.
func (a *App) EnrollWebAuthn(label string) error {
	if err := a.requireUnlocked(); err != nil {
		return fmt.Errorf("app must be unlocked: %w", err)
	}
	if !webauthn.Available() {
		return fmt.Errorf("passkey unlock is not available on this platform")
	}
	if label == "" {
		label = "Passkey"
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

	cred, err := webauthn.Enroll(appWindowTitle, webAuthnRPID, "PaddockControl", "paddock", salt)
	if err != nil {
		return fmt.Errorf("passkey enrollment failed: %w", err)
	}
	defer crypto.Zero(cred.Secret)

	wrappedMasterKey, err := crypto.WrapMasterKey(masterKey, cred.Secret)
	if err != nil {
		return fmt.Errorf("failed to wrap master key: %w", err)
	}

	metaJSON, err := json.Marshal(models.WebAuthnMetadata{CredentialID: cred.CredentialID, Salt: salt})
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	if err := database.WithTx(a.ctx, func(q *sqlc.Queries) error {
		_, e := q.InsertSecurityKey(a.ctx, sqlc.InsertSecurityKeyParams{
			Method:           models.SecurityKeyMethodFIDO2,
			Label:            label,
			WrappedMasterKey: wrappedMasterKey,
			Metadata:         sql.NullString{String: string(metaJSON), Valid: true},
		})
		return e
	}); err != nil {
		return fmt.Errorf("failed to store security key: %w", err)
	}

	log.Info("passkey unlock method enrolled successfully")
	return nil
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

		secret, err := webauthn.Derive(appWindowTitle, webAuthnRPID, meta.CredentialID, meta.Salt)
		if err != nil {
			// User cancelled, wrong authenticator, or this credential isn't present.
			log.Debug("passkey derive failed", logger.Err(err))
			continue
		}
		masterKey, uerr := crypto.UnwrapMasterKey(key.WrappedMasterKey, secret)
		crypto.Zero(secret)
		if uerr != nil {
			continue
		}

		_ = database.Queries().UpdateSecurityKeyLastUsed(a.ctx, key.ID)
		a.finalizeUnlock(masterKey)
		log.Info("unlock via passkey succeeded")
		return true, nil
	}

	return false, fmt.Errorf("passkey unlock failed")
}
