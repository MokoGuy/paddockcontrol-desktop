package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/keystore"
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

	log := logger.WithComponent("app")
	log.Info("enrolling new password method", slog.String("label", label))

	params := crypto.DefaultArgon2idParams()
	salt, err := crypto.GenerateSalt(params.SaltLength)
	if err != nil {
		return fmt.Errorf("failed to generate salt: %w", err)
	}

	wrappingKey := crypto.DeriveKeyFromPassword(password, salt, params)
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

// RemoveSecurityKey removes a security key by ID.
// Prevents removing the last password method.
func (a *App) RemoveSecurityKey(id int64) error {
	a.mu.RLock()
	database := a.db
	a.mu.RUnlock()

	if database == nil {
		return fmt.Errorf("database not initialized")
	}

	log := logger.WithComponent("app")

	// Get the key to check its method
	key, err := database.Queries().GetSecurityKeyByID(a.ctx, id)
	if err != nil {
		return fmt.Errorf("security key not found: %w", err)
	}

	// If removing a password method, ensure it's not the last one
	if key.Method == models.SecurityKeyMethodPassword {
		count, err := database.Queries().CountSecurityKeysByMethod(a.ctx, models.SecurityKeyMethodPassword)
		if err != nil {
			return fmt.Errorf("failed to count password methods: %w", err)
		}
		if count <= 1 {
			return fmt.Errorf("cannot remove the last password unlock method")
		}
	}

	if err := database.Queries().DeleteSecurityKey(a.ctx, id); err != nil {
		return fmt.Errorf("failed to remove security key: %w", err)
	}

	// If removing an OS-native method, also delete from OS keyring
	if key.Method == models.SecurityKeyMethodOSNative {
		ks := keystore.New()
		if err := ks.Delete(keystore.ServiceName, keystore.AccountMasterKey); err != nil {
			log.Error("failed to delete from OS keyring (entry may already be gone)", logger.Err(err))
		}
	}

	log.Info("security key removed", slog.Int64("id", id), slog.String("method", key.Method))
	return nil
}

// ============================================================================
// OS-Native Keyring ("Remember Me")
// ============================================================================

// IsOSKeystoreAvailable returns true if the OS keyring backend is usable.
func (a *App) IsOSKeystoreAvailable() bool {
	ks := keystore.New()
	return ks.Available()
}

// EnrollOSNative stores the wrapped master key in the OS keyring so the app
// can auto-unlock on the next startup without a password prompt.
// Requires the app to be unlocked.
func (a *App) EnrollOSNative() error {
	if err := a.requireUnlocked(); err != nil {
		return fmt.Errorf("app must be unlocked: %w", err)
	}

	ks := keystore.New()
	if !ks.Available() {
		return fmt.Errorf("OS keyring is not available on this system")
	}

	a.mu.RLock()
	masterKey := make([]byte, len(a.masterKey))
	copy(masterKey, a.masterKey)
	database := a.db
	a.mu.RUnlock()

	log := logger.WithComponent("app")
	log.Info("enrolling OS-native keyring unlock method")

	// Generate a random wrapping key for the OS-native method
	wrappingKey, err := crypto.GenerateMasterKey() // 32 random bytes as wrapping key
	if err != nil {
		return fmt.Errorf("failed to generate wrapping key: %w", err)
	}

	wrappedMasterKey, err := crypto.WrapMasterKey(masterKey, wrappingKey)
	if err != nil {
		return fmt.Errorf("failed to wrap master key: %w", err)
	}

	// Store the wrapping key in the OS keyring
	if err := ks.Store(keystore.ServiceName, keystore.AccountMasterKey, wrappingKey); err != nil {
		return fmt.Errorf("failed to store in OS keyring: %w", err)
	}

	// Store the wrapped master key in the database
	_, err = database.Queries().InsertSecurityKey(a.ctx, sqlc.InsertSecurityKeyParams{
		Method:           models.SecurityKeyMethodOSNative,
		Label:            "OS Keyring",
		WrappedMasterKey: wrappedMasterKey,
		Metadata:         sql.NullString{Valid: false},
	})
	if err != nil {
		// Roll back: remove from OS keyring
		_ = ks.Delete(keystore.ServiceName, keystore.AccountMasterKey)
		return fmt.Errorf("failed to store security key: %w", err)
	}

	log.Info("OS-native keyring unlock method enrolled successfully")
	return nil
}

// TryAutoUnlock attempts to unlock the app using the OS keyring.
// Returns true if auto-unlock succeeded, false if not available or failed.
func (a *App) TryAutoUnlock() (bool, error) {
	a.mu.RLock()
	database := a.db
	alreadyUnlocked := a.isUnlocked
	a.mu.RUnlock()

	if alreadyUnlocked {
		return true, nil
	}

	if database == nil {
		return false, nil
	}

	log := logger.WithComponent("app")

	// Check if OS-native method is enrolled
	keys, err := database.Queries().GetSecurityKeysByMethod(a.ctx, models.SecurityKeyMethodOSNative)
	if err != nil || len(keys) == 0 {
		return false, nil
	}

	ks := keystore.New()
	if !ks.Available() {
		log.Debug("OS keyring not available, skipping auto-unlock")
		return false, nil
	}

	// Retrieve the wrapping key from the OS keyring
	wrappingKey, err := ks.Retrieve(keystore.ServiceName, keystore.AccountMasterKey)
	if err != nil {
		log.Debug("failed to retrieve from OS keyring", logger.Err(err))
		return false, nil
	}

	// Try to unwrap the master key using each OS-native entry
	for _, key := range keys {
		masterKey, err := crypto.UnwrapMasterKey(key.WrappedMasterKey, wrappingKey)
		if err != nil {
			continue
		}

		// Update last_used_at
		_ = database.Queries().UpdateSecurityKeyLastUsed(a.ctx, key.ID)

		// Store master key and initialize services
		a.mu.Lock()
		a.masterKey = masterKey
		a.waitingForEncryptionKey = false
		a.isUnlocked = true
		a.needsMigration = false

		a.configService = config.NewService(a.db)
		a.certificateService = services.NewCertificateService(a.db, a.configService)
		a.setupService = services.NewSetupService(a.db, a.configService)
		a.mu.Unlock()

		log.Info("auto-unlock via OS keyring succeeded")
		return true, nil
	}

	log.Debug("OS keyring auto-unlock failed - wrapping key may have changed")
	return false, nil
}
