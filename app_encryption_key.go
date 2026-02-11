package main

import (
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
// Encryption Key Management
// ============================================================================

// IsWaitingForEncryptionKey returns true if app is waiting for encryption key
func (a *App) IsWaitingForEncryptionKey() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.waitingForEncryptionKey
}

// IsEncryptionKeyProvided returns true if encryption key was actually provided (not skipped)
func (a *App) IsEncryptionKeyProvided() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.encryptionKeyProvided
}

// SkipEncryptionKey allows user to skip encryption key entry and proceed with limited functionality
func (a *App) SkipEncryptionKey() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	log := logger.WithComponent("app")

	if a.encryptionKeyProvided {
		return fmt.Errorf("encryption key already provided")
	}

	log.Info("user skipped encryption key entry - limited functionality enabled")
	a.waitingForEncryptionKey = false
	a.encryptionKeyProvided = false

	// Initialize services without encryption key for read-only operations
	a.initializeServicesWithoutKey()

	return nil
}

// ProvideEncryptionKey stores encryption key and initializes services
// Validates the key by testing decryption on ALL stored certificates
func (a *App) ProvideEncryptionKey(key string) (*models.KeyValidationResult, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	_, log := logger.WithOperation(a.ctx, "provide_encryption_key")
	log.Info("encryption key provided, validating")

	if key == "" {
		return nil, fmt.Errorf("encryption key cannot be empty")
	}

	if len(key) < 16 {
		return nil, fmt.Errorf("encryption key must be at least 16 characters")
	}

	// If app is already configured, test decryption on ALL certificates
	if a.isConfigured && a.db != nil {
		log.Info("testing encryption key against all stored certificates")
		certs, err := a.db.Queries().ListAllCertificates(a.ctx)
		if err != nil {
			log.Error("failed to list certificates for key validation", logger.Err(err))
			return nil, fmt.Errorf("failed to validate encryption key")
		}

		var failedHostnames []string

		// Test ALL certificates with encrypted keys
		for _, cert := range certs {
			certLog := logger.WithHostname(log, cert.Hostname)

			// Test active encrypted private key
			if len(cert.EncryptedPrivateKey) > 0 {
				_, err := crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, key)
				if err != nil {
					certLog.Error("encryption key validation failed for certificate")
					failedHostnames = append(failedHostnames, cert.Hostname)
					continue
				}
			}

			// Test pending encrypted private key
			if len(cert.PendingEncryptedPrivateKey) > 0 {
				_, err := crypto.DecryptPrivateKey(cert.PendingEncryptedPrivateKey, key)
				if err != nil {
					certLog.Error("encryption key validation failed for pending key")
					// Only add if not already in the list
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

		// If any certificates failed, return error with details
		if len(failedHostnames) > 0 {
			log.Error("encryption key validation failed",
				slog.Int("failed_count", len(failedHostnames)),
				slog.Any("failed_hostnames", failedHostnames),
			)
			return &models.KeyValidationResult{
				Valid:           false,
				FailedHostnames: failedHostnames,
			}, fmt.Errorf("invalid encryption key: failed to decrypt %d certificate(s)", len(failedHostnames))
		}

		log.Info("encryption key validated successfully against all certificates")
	}

	// Store in memory
	a.encryptionKey = []byte(key)
	a.waitingForEncryptionKey = false
	a.encryptionKeyProvided = true

	log.Info("encryption key validated, initializing services")

	// Initialize services
	a.configService = config.NewService(a.db)
	a.backupService = services.NewBackupService(a.db)
	a.certificateService = services.NewCertificateService(a.db, a.configService)
	a.setupService = services.NewSetupService(a.db, a.configService, a.backupService)

	log.Info("all services initialized successfully")

	return &models.KeyValidationResult{Valid: true}, nil
}

// ClearEncryptionKey clears the provided encryption key and returns to read-only mode
func (a *App) ClearEncryptionKey() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	log := logger.WithComponent("app")

	if !a.encryptionKeyProvided {
		return fmt.Errorf("no encryption key to clear")
	}

	log.Info("clearing encryption key - returning to read-only mode")

	// Zero out the encryption key for security
	for i := range a.encryptionKey {
		a.encryptionKey[i] = 0
	}
	a.encryptionKey = nil
	a.encryptionKeyProvided = false
	// Keep waitingForEncryptionKey = false (user can provide again from Settings)

	return nil
}

// ChangeEncryptionKey changes the encryption key by re-encrypting all certificates atomically
// Requires the current encryption key to be already provided
func (a *App) ChangeEncryptionKey(newKey string) error {
	// Check current key is provided (without holding the lock for the entire operation)
	if err := a.requireEncryptionKey(); err != nil {
		return fmt.Errorf("current encryption key required: %w", err)
	}

	// Validate new key
	if len(newKey) < 16 {
		return fmt.Errorf("new encryption key must be at least 16 characters")
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	_, log := logger.WithOperation(a.ctx, "change_encryption_key")
	log.Info("changing encryption key - starting atomic re-encryption")

	// Get all certificates
	certs, err := a.db.Queries().ListAllCertificates(a.ctx)
	if err != nil {
		log.Error("failed to list certificates", logger.Err(err))
		return fmt.Errorf("failed to list certificates: %w", err)
	}

	// Pre-compute all re-encrypted keys (decrypt with old, encrypt with new)
	type reEncryptedCert struct {
		Hostname                      string
		NewEncryptedPrivateKey        []byte
		NewPendingEncryptedPrivateKey []byte
	}
	var reEncrypted []reEncryptedCert

	oldKey := string(a.encryptionKey)

	for _, cert := range certs {
		certLog := logger.WithHostname(log, cert.Hostname)
		rec := reEncryptedCert{Hostname: cert.Hostname}

		// Re-encrypt active private key if present
		if len(cert.EncryptedPrivateKey) > 0 {
			plaintext, err := crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, oldKey)
			if err != nil {
				certLog.Error("failed to decrypt key", logger.Err(err))
				return fmt.Errorf("failed to decrypt key for %s: %w", cert.Hostname, err)
			}
			newEncrypted, err := crypto.EncryptPrivateKey(plaintext, newKey)
			if err != nil {
				certLog.Error("failed to re-encrypt key", logger.Err(err))
				return fmt.Errorf("failed to re-encrypt key for %s: %w", cert.Hostname, err)
			}
			rec.NewEncryptedPrivateKey = newEncrypted
		}

		// Re-encrypt pending private key if present
		if len(cert.PendingEncryptedPrivateKey) > 0 {
			plaintext, err := crypto.DecryptPrivateKey(cert.PendingEncryptedPrivateKey, oldKey)
			if err != nil {
				certLog.Error("failed to decrypt pending key", logger.Err(err))
				return fmt.Errorf("failed to decrypt pending key for %s: %w", cert.Hostname, err)
			}
			newEncrypted, err := crypto.EncryptPrivateKey(plaintext, newKey)
			if err != nil {
				certLog.Error("failed to re-encrypt pending key", logger.Err(err))
				return fmt.Errorf("failed to re-encrypt pending key for %s: %w", cert.Hostname, err)
			}
			rec.NewPendingEncryptedPrivateKey = newEncrypted
		}

		reEncrypted = append(reEncrypted, rec)
	}

	// Atomic transaction: update all certificates
	tx, err := a.db.GetDB().BeginTx(a.ctx, nil)
	if err != nil {
		log.Error("failed to begin transaction", logger.Err(err))
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback() // Will be no-op if commit succeeds

	qtx := a.db.Queries().WithTx(tx)

	for _, rec := range reEncrypted {
		err := qtx.UpdateEncryptedKeys(a.ctx, sqlc.UpdateEncryptedKeysParams{
			EncryptedPrivateKey:        rec.NewEncryptedPrivateKey,
			PendingEncryptedPrivateKey: rec.NewPendingEncryptedPrivateKey,
			Hostname:                   rec.Hostname,
		})
		if err != nil {
			log.Error("failed to update keys",
				slog.String("hostname", rec.Hostname),
				logger.Err(err),
			)
			return fmt.Errorf("failed to update keys for %s: %w", rec.Hostname, err)
		}
	}

	if err := tx.Commit(); err != nil {
		log.Error("failed to commit transaction", logger.Err(err))
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Update in-memory key - zero out old key for security
	for i := range a.encryptionKey {
		a.encryptionKey[i] = 0
	}
	a.encryptionKey = []byte(newKey)

	log.Info("encryption key changed successfully", slog.Int("re_encrypted_count", len(reEncrypted)))
	return nil
}
