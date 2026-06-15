package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"
	"paddockcontrol-desktop/internal/services"
)

// ============================================================================
// Security Key Management
// ============================================================================

// ListSecurityKeys returns all enrolled security methods (without wrapped key data).
func (a *App) ListSecurityKeys() ([]models.SecurityKeyInfo, error) {
	a.mu.RLock()
	database := a.db
	a.mu.RUnlock()

	if database == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	rows, err := database.Queries().ListSecurityKeys(a.ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list security keys: %w", err)
	}

	result := make([]models.SecurityKeyInfo, len(rows))
	for i, row := range rows {
		result[i] = models.SecurityKeyInfo{
			ID:        row.ID,
			Method:    row.Method,
			Label:     row.Label,
			CreatedAt: row.CreatedAt,
		}
		if row.LastUsedAt.Valid {
			val := row.LastUsedAt.Int64
			result[i].LastUsedAt = &val
		}
	}

	return result, nil
}

// HasSecurityKeys returns true if any security keys are enrolled.
func (a *App) HasSecurityKeys() (bool, error) {
	a.mu.RLock()
	database := a.db
	a.mu.RUnlock()

	if database == nil {
		return false, fmt.Errorf("database not initialized")
	}

	has, err := database.Queries().HasAnySecurityKeys(a.ctx)
	if err != nil {
		return false, fmt.Errorf("failed to check security keys: %w", err)
	}

	return has == 1, nil
}

// NeedsMigration returns true if the database contains legacy-format encrypted
// certificates that need to be migrated to the master key format.
func (a *App) NeedsMigration() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.needsMigration
}

// EnrollPasswordMethod adds a new password-based unlock method.
// Requires the app to be unlocked (master key in memory).
func (a *App) EnrollPasswordMethod(password, label string) error {
	if err := a.requireUnlocked(); err != nil {
		return fmt.Errorf("app must be unlocked: %w", err)
	}

	if len(password) < 16 {
		return fmt.Errorf("password must be at least 16 characters")
	}

	if label == "" {
		label = "Password"
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
	log.Info("enrolling new password method", slog.String("label", label))

	params := crypto.DefaultArgon2idParams()
	salt, err := crypto.GenerateSalt(params.SaltLength)
	if err != nil {
		return fmt.Errorf("failed to generate salt: %w", err)
	}

	wrappingKey := crypto.DeriveKeyFromPassword(password, salt, params)
	defer crypto.Zero(wrappingKey)
	wrappedMasterKey, err := crypto.WrapMasterKey(masterKey, wrappingKey)
	if err != nil {
		return fmt.Errorf("failed to wrap master key: %w", err)
	}

	metadata := models.PasswordMetadata{
		Salt:              salt,
		Argon2Memory:      params.Memory,
		Argon2Iterations:  params.Iterations,
		Argon2Parallelism: params.Parallelism,
	}
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	_, err = database.Queries().InsertSecurityKey(a.ctx, sqlc.InsertSecurityKeyParams{
		Method:           models.SecurityKeyMethodPassword,
		Label:            label,
		WrappedMasterKey: wrappedMasterKey,
		Metadata:         sql.NullString{String: string(metadataJSON), Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to store security key: %w", err)
	}

	log.Info("password method enrolled successfully")
	return nil
}

// RemoveSecurityKey removes a security key (unlock method) by ID.
func (a *App) RemoveSecurityKey(id int64) error {
	a.mu.RLock()
	database := a.db
	a.mu.RUnlock()

	if database == nil {
		return fmt.Errorf("database not initialized")
	}

	log := logger.WithComponent("app")

	key, err := database.Queries().GetSecurityKeyByID(a.ctx, id)
	if err != nil {
		return fmt.Errorf("security key not found: %w", err)
	}

	// Password is the permanent root unlock method and can never be removed — it
	// is changed (not removed) via ChangeEncryptionKey. Only convenience methods
	// (passkeys) are revocable. Removing a passkey just drops the DB row; the
	// credential is non-resident, so nothing is stored on the authenticator.
	if key.Method == models.SecurityKeyMethodPassword {
		return fmt.Errorf("the password unlock method cannot be removed; use Change Password instead")
	}

	if err := database.Queries().DeleteSecurityKey(a.ctx, id); err != nil {
		return fmt.Errorf("failed to remove security key: %w", err)
	}

	log.Info("security key removed", slog.Int64("id", id), slog.String("method", key.Method))
	return nil
}

// finalizeUnlock stores the master key in memory and (re)initializes the
// key-dependent services. Shared by every non-password unlock path.
func (a *App) finalizeUnlock(masterKey []byte) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.masterKey = masterKey
	a.waitingForEncryptionKey = false
	a.isUnlocked = true
	a.needsMigration = false
	a.configService = config.NewService(a.db)
	a.certificateService = services.NewCertificateService(a.db, a.configService)
	a.setupService = services.NewSetupService(a.db, a.configService)
}
