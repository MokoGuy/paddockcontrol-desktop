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
// Password / Master Key Management
// ============================================================================

// IsWaitingForEncryptionKey returns true if app is waiting for encryption key
func (a *App) IsWaitingForEncryptionKey() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.waitingForEncryptionKey
}

// IsUnlocked returns true if the app is unlocked
func (a *App) IsUnlocked() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.isUnlocked
}

// SkipEncryptionKey allows user to skip encryption key entry and proceed with limited functionality
func (a *App) SkipEncryptionKey() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	log := logger.WithComponent("app")

	if a.isUnlocked {
		return fmt.Errorf("encryption key already provided")
	}

	log.Info("user skipped encryption key entry - limited functionality enabled")
	a.waitingForEncryptionKey = false
	a.isUnlocked = false

	// Initialize services without encryption key for read-only operations
	a.initializeServicesWithoutKey()

	return nil
}

// ProvideEncryptionKey unlocks the application with a password.
//
// Three code paths:
//  1. Migration: encrypted certs exist but no security_keys rows (pre-v1.4.0 database).
//     Validates the password via legacy SHA-256 decryption, generates a new master key,
//     re-encrypts all certs with the master key, and creates an Argon2id wrapping entry.
//  2. First-time setup: no security_keys and no encrypted certs.
//     Generates a fresh master key, wraps it with Argon2id(password), and stores the row.
//  3. Normal unlock: security_keys rows exist.
//     Iterates password-method entries, derives the wrapping key with Argon2id, and
//     attempts to unwrap the master key.
func (a *App) ProvideEncryptionKey(password string) (*models.KeyValidationResult, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	_, log := logger.WithOperation(a.ctx, "provide_encryption_key")
	log.Info("password provided, validating")

	if password == "" {
		return nil, fmt.Errorf("password cannot be empty")
	}

	if len(password) < 16 {
		return nil, fmt.Errorf("password must be at least 16 characters")
	}

	if a.db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	// Determine which unlock path to use
	hasKeys, err := a.db.Queries().HasAnySecurityKeys(a.ctx)
	if err != nil {
		log.Error("failed to check security keys", logger.Err(err))
		return nil, fmt.Errorf("failed to check security keys: %w", err)
	}

	var masterKey []byte

	if hasKeys == 1 {
		// Path 3: Normal unlock — try to unwrap master key from password entries
		masterKey, err = a.unlockWithPassword(log, password)
		if err != nil {
			return &models.KeyValidationResult{Valid: false}, err
		}
	} else if a.isConfigured {
		// Check if there are encrypted certs (migration needed) or not (first-time for configured app)
		hasCerts, err := a.hasEncryptedCertificates()
		if err != nil {
			return nil, err
		}
		if hasCerts {
			// Path 1: Migration from legacy SHA-256 format
			masterKey, err = a.migrateLegacyEncryption(log, password)
			if err != nil {
				return nil, err
			}
		} else {
			// First-time setup for configured app with no encrypted certs
			masterKey, err = a.createNewMasterKey(log, password)
			if err != nil {
				return nil, err
			}
		}
	} else {
		// Path 2: First-time setup — no config, no certs, no keys
		masterKey, err = a.createNewMasterKey(log, password)
		if err != nil {
			return nil, err
		}
	}

	// Store master key in memory
	a.masterKey = masterKey
	a.waitingForEncryptionKey = false
	a.isUnlocked = true
	a.needsMigration = false

	log.Info("password validated, initializing services")

	// Initialize services
	a.configService = config.NewService(a.db)
	a.backupService = services.NewBackupService(a.db)
	a.certificateService = services.NewCertificateService(a.db, a.configService)
	a.setupService = services.NewSetupService(a.db, a.configService, a.backupService)

	log.Info("all services initialized successfully")

	return &models.KeyValidationResult{Valid: true}, nil
}

// ClearEncryptionKey clears the provided master key and returns to read-only mode
func (a *App) ClearEncryptionKey() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	log := logger.WithComponent("app")

	if !a.isUnlocked {
		return fmt.Errorf("no encryption key to clear")
	}

	log.Info("clearing master key - returning to read-only mode")

	// Zero out the master key for security
	for i := range a.masterKey {
		a.masterKey[i] = 0
	}
	a.masterKey = nil
	a.isUnlocked = false
	// Keep waitingForEncryptionKey = false (user can provide again from Settings)

	return nil
}

// ChangeEncryptionKey changes the password by re-wrapping the master key.
// No certificate re-encryption is needed — only the wrapping key changes.
func (a *App) ChangeEncryptionKey(newPassword string) error {
	if err := a.requireUnlocked(); err != nil {
		return fmt.Errorf("current password required: %w", err)
	}

	if len(newPassword) < 16 {
		return fmt.Errorf("new password must be at least 16 characters")
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	_, log := logger.WithOperation(a.ctx, "change_password")
	log.Info("changing password - re-wrapping master key")

	// Derive new wrapping key from new password
	params := crypto.DefaultArgon2idParams()
	salt, err := crypto.GenerateSalt(params.SaltLength)
	if err != nil {
		log.Error("failed to generate salt", logger.Err(err))
		return fmt.Errorf("failed to generate salt: %w", err)
	}

	wrappingKey := crypto.DeriveKeyFromPassword(newPassword, salt, params)
	wrappedMasterKey, err := crypto.WrapMasterKey(a.masterKey, wrappingKey)
	if err != nil {
		log.Error("failed to wrap master key", logger.Err(err))
		return fmt.Errorf("failed to wrap master key: %w", err)
	}

	// Serialize metadata
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

	// Atomic transaction: delete old password entries, insert new one
	tx, err := a.db.GetDB().BeginTx(a.ctx, nil)
	if err != nil {
		log.Error("failed to begin transaction", logger.Err(err))
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	qtx := a.db.Queries().WithTx(tx)

	if err := qtx.DeleteSecurityKeysByMethod(a.ctx, models.SecurityKeyMethodPassword); err != nil {
		log.Error("failed to delete old password entries", logger.Err(err))
		return fmt.Errorf("failed to delete old password entries: %w", err)
	}

	_, err = qtx.InsertSecurityKey(a.ctx, sqlc.InsertSecurityKeyParams{
		Method:           models.SecurityKeyMethodPassword,
		Label:            "Password",
		WrappedMasterKey: wrappedMasterKey,
		Metadata:         sql.NullString{String: string(metadataJSON), Valid: true},
	})
	if err != nil {
		log.Error("failed to insert new password entry", logger.Err(err))
		return fmt.Errorf("failed to insert new password entry: %w", err)
	}

	if err := tx.Commit(); err != nil {
		log.Error("failed to commit transaction", logger.Err(err))
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Info("password changed successfully (master key re-wrapped)")
	return nil
}

// ============================================================================
// Internal helpers
// ============================================================================

// unlockWithPassword tries to unwrap the master key using a password against
// all password-method security key entries.
func (a *App) unlockWithPassword(log *slog.Logger, password string) ([]byte, error) {
	keys, err := a.db.Queries().GetSecurityKeysByMethod(a.ctx, models.SecurityKeyMethodPassword)
	if err != nil {
		log.Error("failed to get password security keys", logger.Err(err))
		return nil, fmt.Errorf("failed to get security keys: %w", err)
	}

	if len(keys) == 0 {
		return nil, fmt.Errorf("no password unlock method configured")
	}

	for _, key := range keys {
		var metadata models.PasswordMetadata
		if key.Metadata.Valid {
			if err := json.Unmarshal([]byte(key.Metadata.String), &metadata); err != nil {
				log.Error("failed to parse security key metadata", slog.Int64("key_id", key.ID), logger.Err(err))
				continue
			}
		}

		params := crypto.Argon2idParams{
			Memory:      metadata.Argon2Memory,
			Iterations:  metadata.Argon2Iterations,
			Parallelism: metadata.Argon2Parallelism,
			KeyLength:   32,
			SaltLength:  uint32(len(metadata.Salt)),
		}

		wrappingKey := crypto.DeriveKeyFromPassword(password, metadata.Salt, params)
		masterKey, err := crypto.UnwrapMasterKey(key.WrappedMasterKey, wrappingKey)
		if err != nil {
			// Wrong password for this entry — try next
			continue
		}

		// Update last_used_at
		_ = a.db.Queries().UpdateSecurityKeyLastUsed(a.ctx, key.ID)

		log.Info("master key unwrapped successfully", slog.Int64("security_key_id", key.ID))
		return masterKey, nil
	}

	return nil, fmt.Errorf("invalid password: failed to unlock")
}

// migrateLegacyEncryption handles migration from pre-v1.4.0 SHA-256 format.
// DEPRECATED(v2.0.0): Remove this function and the legacy code path.
func (a *App) migrateLegacyEncryption(log *slog.Logger, password string) ([]byte, error) {
	log.Info("migrating from legacy SHA-256 encryption format")

	// First validate the password against all encrypted certs using legacy format
	certs, err := a.db.Queries().ListAllCertificates(a.ctx)
	if err != nil {
		log.Error("failed to list certificates", logger.Err(err))
		return nil, fmt.Errorf("failed to list certificates: %w", err)
	}

	var failedHostnames []string
	for _, cert := range certs {
		if len(cert.EncryptedPrivateKey) > 0 {
			if _, err := crypto.DecryptPrivateKeyLegacy(cert.EncryptedPrivateKey, password); err != nil {
				failedHostnames = append(failedHostnames, cert.Hostname)
				continue
			}
		}
		if len(cert.PendingEncryptedPrivateKey) > 0 {
			if _, err := crypto.DecryptPrivateKeyLegacy(cert.PendingEncryptedPrivateKey, password); err != nil {
				found := false
				for _, h := range failedHostnames {
					if h == cert.Hostname {
						found = true
						break
					}
				}
				if !found {
					failedHostnames = append(failedHostnames, cert.Hostname)
				}
			}
		}
	}

	if len(failedHostnames) > 0 {
		log.Error("legacy password validation failed",
			slog.Int("failed_count", len(failedHostnames)),
			slog.Any("failed_hostnames", failedHostnames),
		)
		return nil, fmt.Errorf("invalid password: failed to decrypt %d certificate(s)", len(failedHostnames))
	}

	// Password validated. Generate new master key.
	masterKey, err := crypto.GenerateMasterKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate master key: %w", err)
	}

	// Re-encrypt all certs: decrypt with legacy password, encrypt with new master key
	type reEncryptedCert struct {
		Hostname                      string
		NewEncryptedPrivateKey        []byte
		NewPendingEncryptedPrivateKey []byte
	}
	var reEncrypted []reEncryptedCert

	for _, cert := range certs {
		rec := reEncryptedCert{Hostname: cert.Hostname}

		if len(cert.EncryptedPrivateKey) > 0 {
			plaintext, err := crypto.DecryptPrivateKeyLegacy(cert.EncryptedPrivateKey, password)
			if err != nil {
				return nil, fmt.Errorf("failed to decrypt key for %s during migration: %w", cert.Hostname, err)
			}
			// EncryptPrivateKey wipes plaintext, so we're good
			encrypted, err := crypto.EncryptPrivateKey(plaintext, masterKey)
			if err != nil {
				return nil, fmt.Errorf("failed to re-encrypt key for %s: %w", cert.Hostname, err)
			}
			rec.NewEncryptedPrivateKey = encrypted
		}

		if len(cert.PendingEncryptedPrivateKey) > 0 {
			plaintext, err := crypto.DecryptPrivateKeyLegacy(cert.PendingEncryptedPrivateKey, password)
			if err != nil {
				return nil, fmt.Errorf("failed to decrypt pending key for %s during migration: %w", cert.Hostname, err)
			}
			encrypted, err := crypto.EncryptPrivateKey(plaintext, masterKey)
			if err != nil {
				return nil, fmt.Errorf("failed to re-encrypt pending key for %s: %w", cert.Hostname, err)
			}
			rec.NewPendingEncryptedPrivateKey = encrypted
		}

		reEncrypted = append(reEncrypted, rec)
	}

	// Wrap master key with Argon2id(password)
	params := crypto.DefaultArgon2idParams()
	salt, err := crypto.GenerateSalt(params.SaltLength)
	if err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}

	wrappingKey := crypto.DeriveKeyFromPassword(password, salt, params)
	wrappedMasterKey, err := crypto.WrapMasterKey(masterKey, wrappingKey)
	if err != nil {
		return nil, fmt.Errorf("failed to wrap master key: %w", err)
	}

	metadata := models.PasswordMetadata{
		Salt:              salt,
		Argon2Memory:      params.Memory,
		Argon2Iterations:  params.Iterations,
		Argon2Parallelism: params.Parallelism,
	}
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Atomic transaction: update all certs + insert security key
	tx, err := a.db.GetDB().BeginTx(a.ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin migration transaction: %w", err)
	}
	defer tx.Rollback()

	qtx := a.db.Queries().WithTx(tx)

	for _, rec := range reEncrypted {
		if err := qtx.UpdateEncryptedKeys(a.ctx, sqlc.UpdateEncryptedKeysParams{
			EncryptedPrivateKey:        rec.NewEncryptedPrivateKey,
			PendingEncryptedPrivateKey: rec.NewPendingEncryptedPrivateKey,
			Hostname:                   rec.Hostname,
		}); err != nil {
			return nil, fmt.Errorf("failed to update keys for %s: %w", rec.Hostname, err)
		}
	}

	if _, err := qtx.InsertSecurityKey(a.ctx, sqlc.InsertSecurityKeyParams{
		Method:           models.SecurityKeyMethodPassword,
		Label:            "Password",
		WrappedMasterKey: wrappedMasterKey,
		Metadata:         sql.NullString{String: string(metadataJSON), Valid: true},
	}); err != nil {
		return nil, fmt.Errorf("failed to insert security key: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit migration transaction: %w", err)
	}

	log.Info("legacy encryption migration completed successfully",
		slog.Int("re_encrypted_certs", len(reEncrypted)),
	)

	return masterKey, nil
}

// createNewMasterKey generates a fresh master key and wraps it with the password.
func (a *App) createNewMasterKey(log *slog.Logger, password string) ([]byte, error) {
	log.Info("creating new master key")

	masterKey, err := crypto.GenerateMasterKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate master key: %w", err)
	}

	params := crypto.DefaultArgon2idParams()
	salt, err := crypto.GenerateSalt(params.SaltLength)
	if err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}

	wrappingKey := crypto.DeriveKeyFromPassword(password, salt, params)
	wrappedMasterKey, err := crypto.WrapMasterKey(masterKey, wrappingKey)
	if err != nil {
		return nil, fmt.Errorf("failed to wrap master key: %w", err)
	}

	metadata := models.PasswordMetadata{
		Salt:              salt,
		Argon2Memory:      params.Memory,
		Argon2Iterations:  params.Iterations,
		Argon2Parallelism: params.Parallelism,
	}
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	_, err = a.db.Queries().InsertSecurityKey(a.ctx, sqlc.InsertSecurityKeyParams{
		Method:           models.SecurityKeyMethodPassword,
		Label:            "Password",
		WrappedMasterKey: wrappedMasterKey,
		Metadata:         sql.NullString{String: string(metadataJSON), Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to store security key: %w", err)
	}

	log.Info("new master key created and wrapped with password")
	return masterKey, nil
}

// hasEncryptedCertificates checks if any certificate has encrypted key data.
func (a *App) hasEncryptedCertificates() (bool, error) {
	certs, err := a.db.Queries().ListAllCertificates(a.ctx)
	if err != nil {
		return false, fmt.Errorf("failed to list certificates: %w", err)
	}
	for _, cert := range certs {
		if len(cert.EncryptedPrivateKey) > 0 || len(cert.PendingEncryptedPrivateKey) > 0 {
			return true, nil
		}
	}
	return false, nil
}
