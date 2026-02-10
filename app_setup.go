package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"
)

// ============================================================================
// Setup Operations
// ============================================================================

// IsSetupComplete returns true if initial setup is complete
func (a *App) IsSetupComplete() (bool, error) {
	a.mu.RLock()
	setupService := a.setupService
	isConfigured := a.isConfigured
	a.mu.RUnlock()

	// During startup, before encryption key provided
	if setupService == nil {
		return isConfigured, nil
	}

	return setupService.IsConfigured(a.ctx)
}

// SaveSetup creates new configuration from scratch
func (a *App) SaveSetup(req models.SetupRequest) error {
	// No encryption key required - just saving CA configuration
	_, log := logger.WithOperation(a.ctx, "save_setup")
	log.Info("saving setup configuration",
		slog.String("owner_email", req.OwnerEmail),
		slog.String("ca_name", req.CAName),
	)

	a.mu.RLock()
	setupService := a.setupService
	a.mu.RUnlock()

	if setupService == nil {
		return fmt.Errorf("setup service not initialized")
	}

	if err := setupService.SetupFromScratch(a.ctx, req); err != nil {
		log.Error("setup from scratch failed", logger.Err(err))
		return err
	}

	a.mu.Lock()
	a.isConfigured = true
	a.mu.Unlock()

	log.Info("setup completed successfully")
	return nil
}

// ValidateBackupFile reads and validates backup file structure
func (a *App) ValidateBackupFile(path string) (*models.BackupValidationResult, error) {
	log := logger.WithComponent("app")
	log.Info("validating backup file", slog.String("path", path))

	data, err := os.ReadFile(path)
	if err != nil {
		log.Error("failed to read backup file", logger.Err(err))
		return nil, fmt.Errorf("failed to read backup file: %w", err)
	}

	var backup models.BackupData
	if err := json.Unmarshal(data, &backup); err != nil {
		log.Error("failed to parse backup file", logger.Err(err))
		return nil, fmt.Errorf("invalid backup file format: %w", err)
	}

	hasEncryptedKeys := false
	for _, cert := range backup.Certificates {
		if len(cert.EncryptedKey) > 0 || len(cert.PendingEncryptedKey) > 0 {
			hasEncryptedKeys = true
			break
		}
	}

	result := &models.BackupValidationResult{
		Valid:            true,
		Version:          backup.Version,
		CertificateCount: len(backup.Certificates),
		HasEncryptedKeys: hasEncryptedKeys,
		HasEncryptionKey: backup.EncryptionKey != "",
		EncryptionKey:    backup.EncryptionKey,
		ExportedAt:       backup.ExportedAt,
	}

	log.Info("backup validation complete",
		slog.Bool("valid", result.Valid),
		slog.Int("certificate_count", result.CertificateCount),
		slog.Bool("has_encrypted_keys", result.HasEncryptedKeys),
		slog.Bool("has_key_in_backup", result.HasEncryptionKey),
	)

	return result, nil
}

// ValidateEncryptionKeyForBackup tests if encryption key can decrypt backup keys
func (a *App) ValidateEncryptionKeyForBackup(backup models.BackupData, key string) error {
	log := logger.WithComponent("app")
	log.Info("validating encryption key for backup restore")

	if len(key) < 16 {
		return fmt.Errorf("encryption key must be at least 16 characters")
	}

	// Find first certificate with encrypted key
	for _, cert := range backup.Certificates {
		if len(cert.EncryptedKey) > 0 {
			// Try to decrypt
			_, err := crypto.DecryptPrivateKey(cert.EncryptedKey, key)
			if err != nil {
				log.Error("encryption key validation failed", logger.Err(err))
				return fmt.Errorf("invalid encryption key: cannot decrypt certificate keys")
			}

			log.Info("encryption key validated successfully")
			return nil
		}

		if len(cert.PendingEncryptedKey) > 0 {
			_, err := crypto.DecryptPrivateKey(cert.PendingEncryptedKey, key)
			if err != nil {
				log.Error("encryption key validation failed", logger.Err(err))
				return fmt.Errorf("invalid encryption key: cannot decrypt certificate keys")
			}

			log.Info("encryption key validated successfully")
			return nil
		}
	}

	// No encrypted keys found - validation passes
	log.Info("no encrypted keys in backup, validation skipped")
	return nil
}

// RestoreFromBackup imports backup and marks setup complete
func (a *App) RestoreFromBackup(backup models.BackupData) error {
	if err := a.requireEncryptionKey(); err != nil {
		return err
	}

	_, log := logger.WithOperation(a.ctx, "restore_backup")
	log.Info("restoring from backup",
		slog.String("version", backup.Version),
		slog.Int("certificates", len(backup.Certificates)),
	)

	a.performAutoBackup("restore_backup")

	a.mu.RLock()
	setupService := a.setupService
	encryptionKey := make([]byte, len(a.encryptionKey))
	copy(encryptionKey, a.encryptionKey)
	a.mu.RUnlock()

	if setupService == nil {
		return fmt.Errorf("setup service not initialized")
	}

	if err := setupService.SetupFromBackup(a.ctx, &backup, encryptionKey); err != nil {
		log.Error("restore from backup failed", logger.Err(err))
		return err
	}

	a.mu.Lock()
	a.isConfigured = true
	a.waitingForEncryptionKey = false // Key was provided during restore
	a.encryptionKeyProvided = true
	a.mu.Unlock()

	log.Info("restore completed successfully")
	return nil
}

// GetSetupDefaults returns default values for setup form
func (a *App) GetSetupDefaults() *models.SetupDefaults {
	a.mu.RLock()
	setupService := a.setupService
	a.mu.RUnlock()

	if setupService == nil {
		return &models.SetupDefaults{
			ValidityPeriodDays: 365,
			DefaultKeySize:     4096,
			DefaultCountry:     "FR",
		}
	}
	return setupService.GetSetupDefaults()
}

// GetConfig returns the current configuration
func (a *App) GetConfig() (*models.Config, error) {
	log := logger.WithComponent("app")
	log.Debug("getting configuration")

	a.mu.RLock()
	configService := a.configService
	a.mu.RUnlock()

	if configService == nil {
		return nil, fmt.Errorf("config service not initialized")
	}

	cfg, err := configService.GetConfig(a.ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}

	// Convert sqlc.Config to models.Config
	return &models.Config{
		ID:                        int(cfg.ID),
		OwnerEmail:                cfg.OwnerEmail,
		CAName:                    cfg.CaName,
		HostnameSuffix:            cfg.HostnameSuffix,
		ValidityPeriodDays:        int(cfg.ValidityPeriodDays),
		DefaultOrganization:       cfg.DefaultOrganization,
		DefaultOrganizationalUnit: cfg.DefaultOrganizationalUnit.String,
		DefaultCity:               cfg.DefaultCity,
		DefaultState:              cfg.DefaultState,
		DefaultCountry:            cfg.DefaultCountry,
		DefaultKeySize:            int(cfg.DefaultKeySize),
		IsConfigured:              int(cfg.IsConfigured),
		CreatedAt:                 cfg.CreatedAt,
		LastModified:              cfg.LastModified,
	}, nil
}

// UpdateConfig updates the application configuration
func (a *App) UpdateConfig(req models.UpdateConfigRequest) (*models.Config, error) {
	_, log := logger.WithOperation(a.ctx, "update_config")
	log.Info("updating configuration",
		slog.String("owner_email", req.OwnerEmail),
		slog.String("ca_name", req.CAName),
	)

	// Validate request
	if err := config.ValidateConfigUpdate(&req); err != nil {
		log.Error("config validation failed", logger.Err(err))
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	a.mu.RLock()
	configService := a.configService
	a.mu.RUnlock()

	if configService == nil {
		return nil, fmt.Errorf("config service not initialized")
	}

	// Update configuration
	updatedConfig, err := configService.UpdateConfig(a.ctx, &req)
	if err != nil {
		log.Error("failed to update config", logger.Err(err))
		return nil, fmt.Errorf("failed to update config: %w", err)
	}

	log.Info("configuration updated successfully")
	return updatedConfig, nil
}
