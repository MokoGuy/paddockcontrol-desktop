package services

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"
)

// SetupService handles initial application setup and configuration
type SetupService struct {
	db            *db.Database
	config        *config.Service
	backupService *BackupService
	log           *slog.Logger
}

// NewSetupService creates a new setup service
func NewSetupService(database *db.Database, configSvc *config.Service, backupSvc *BackupService) *SetupService {
	return &SetupService{
		db:            database,
		config:        configSvc,
		backupService: backupSvc,
		log:           logger.WithComponent("setup"),
	}
}

// IsConfigured checks if initial setup is complete
func (s *SetupService) IsConfigured(ctx context.Context) (bool, error) {
	return s.config.IsConfigured(ctx)
}

// SetupFromScratch creates a new configuration from scratch
func (s *SetupService) SetupFromScratch(ctx context.Context, req models.SetupRequest) error {
	ctx, log := logger.WithOperation(ctx, "setup_fresh")
	log.Info("starting fresh setup",
		slog.String("owner_email", req.OwnerEmail),
		slog.String("ca_name", req.CAName),
		slog.String("hostname_suffix", req.HostnameSuffix),
	)

	// Validate setup request
	if err := s.validateSetupRequest(req); err != nil {
		log.Error("setup request validation failed", logger.Err(err))
		return err
	}
	log.Debug("setup request validated")

	// Create config record in database
	err := s.db.Queries().CreateConfig(ctx, sqlc.CreateConfigParams{
		OwnerEmail:                req.OwnerEmail,
		CaName:                    req.CAName,
		HostnameSuffix:            req.HostnameSuffix,
		DefaultOrganization:       req.DefaultOrganization,
		DefaultOrganizationalUnit: stringToNullString(req.DefaultOrganizationalUnit),
		DefaultCity:               req.DefaultCity,
		DefaultState:              req.DefaultState,
		DefaultCountry:            req.DefaultCountry,
		DefaultKeySize:            int64(req.DefaultKeySize),
		ValidityPeriodDays:        int64(req.ValidityPeriodDays),
	})
	if err != nil {
		log.Error("failed to create configuration", logger.Err(err))
		return fmt.Errorf("failed to create configuration: %w", err)
	}
	log.Debug("configuration record created")

	// Mark as configured
	err = s.config.SetConfigured(ctx)
	if err != nil {
		log.Error("failed to mark as configured", logger.Err(err))
		return fmt.Errorf("failed to mark as configured: %w", err)
	}

	log.Info("fresh setup completed successfully")
	return nil
}

// SetupFromBackup restores application from backup file
// If backup contains encrypted keys, validates encryption key can decrypt them
// If backup lacks encrypted keys, skips key validation
func (s *SetupService) SetupFromBackup(ctx context.Context, backup *models.BackupData, encryptionKey []byte) error {
	ctx, log := logger.WithOperation(ctx, "setup_restore")

	if backup == nil {
		log.Error("backup data is nil")
		return fmt.Errorf("backup data is nil")
	}

	log.Info("starting setup from backup",
		slog.String("backup_version", backup.Version),
		slog.Int("certificates", len(backup.Certificates)),
	)

	// Check if backup contains encrypted keys
	hasEncryptedKeys := s.backupHasEncryptedKeys(backup)
	log.Debug("backup encryption check", slog.Bool("has_encrypted_keys", hasEncryptedKeys))

	// If backup has encrypted keys, validate encryption key can decrypt them
	if hasEncryptedKeys {
		log.Debug("validating encryption key against backup")
		if err := s.validateEncryptionKey(backup, encryptionKey); err != nil {
			log.Error("encryption key validation failed", logger.Err(err))
			return err
		}
		log.Debug("encryption key validated successfully")
	}

	// Import all certificates from backup with strict validation
	log.Info("importing certificates from backup")
	result, err := s.backupService.ImportBackup(ctx, backup, encryptionKey)
	if err != nil {
		log.Error("backup import failed", logger.Err(err))
		return fmt.Errorf("backup import failed: %w", err)
	}
	log.Info("certificates imported", slog.Int("count", result.Success))

	// Create config record in database if not exists
	configExists, err := s.db.Queries().ConfigExists(ctx)
	if err != nil {
		log.Error("failed to check configuration existence", logger.Err(err))
		return fmt.Errorf("failed to check configuration: %w", err)
	}

	if configExists == 0 {
		log.Debug("creating new configuration from backup")
		err = s.db.Queries().CreateConfig(ctx, sqlc.CreateConfigParams{
			OwnerEmail:                backup.Config.OwnerEmail,
			CaName:                    backup.Config.CAName,
			HostnameSuffix:            backup.Config.HostnameSuffix,
			DefaultOrganization:       backup.Config.DefaultOrganization,
			DefaultOrganizationalUnit: stringToNullString(backup.Config.DefaultOrganizationalUnit),
			DefaultCity:               backup.Config.DefaultCity,
			DefaultState:              backup.Config.DefaultState,
			DefaultCountry:            backup.Config.DefaultCountry,
			DefaultKeySize:            int64(backup.Config.DefaultKeySize),
			ValidityPeriodDays:        int64(backup.Config.ValidityPeriodDays),
		})
		if err != nil {
			log.Error("failed to create configuration", logger.Err(err))
			return fmt.Errorf("failed to create configuration: %w", err)
		}
	} else {
		log.Debug("updating existing configuration from backup")
		// Update existing config with backup values
		err = s.db.Queries().UpdateConfig(ctx, sqlc.UpdateConfigParams{
			OwnerEmail:                backup.Config.OwnerEmail,
			CaName:                    backup.Config.CAName,
			HostnameSuffix:            backup.Config.HostnameSuffix,
			DefaultOrganization:       backup.Config.DefaultOrganization,
			DefaultOrganizationalUnit: stringToNullString(backup.Config.DefaultOrganizationalUnit),
			DefaultCity:               backup.Config.DefaultCity,
			DefaultState:              backup.Config.DefaultState,
			DefaultCountry:            backup.Config.DefaultCountry,
			DefaultKeySize:            int64(backup.Config.DefaultKeySize),
			ValidityPeriodDays:        int64(backup.Config.ValidityPeriodDays),
		})
		if err != nil {
			log.Error("failed to update configuration", logger.Err(err))
			return fmt.Errorf("failed to update configuration: %w", err)
		}
	}

	// Mark as configured
	err = s.config.SetConfigured(ctx)
	if err != nil {
		log.Error("failed to mark as configured", logger.Err(err))
		return fmt.Errorf("failed to mark as configured: %w", err)
	}

	log.Info("setup from backup completed successfully",
		slog.Int("certificates_restored", result.Success),
	)
	return nil
}

// GetSetupDefaults returns default values for setup form
func (s *SetupService) GetSetupDefaults() *models.SetupDefaults {
	return &models.SetupDefaults{
		ValidityPeriodDays: 365,
		DefaultKeySize:     4096,
		DefaultCountry:     "FR",
	}
}

// Helper methods

// validateSetupRequest validates the setup request for required fields
func (s *SetupService) validateSetupRequest(req models.SetupRequest) error {
	if req.OwnerEmail == "" {
		return fmt.Errorf("owner email is required")
	}

	if req.CAName == "" {
		return fmt.Errorf("CA name is required")
	}

	if req.DefaultOrganization == "" {
		return fmt.Errorf("default organization is required")
	}

	if req.DefaultCity == "" {
		return fmt.Errorf("default city is required")
	}

	if req.DefaultState == "" {
		return fmt.Errorf("default state is required")
	}

	if req.DefaultCountry == "" {
		return fmt.Errorf("default country is required")
	}

	if len(req.DefaultCountry) != 2 {
		return fmt.Errorf("default country must be a 2-letter ISO code")
	}

	if req.DefaultKeySize < 2048 {
		return fmt.Errorf("default key size must be at least 2048 bits")
	}

	if req.ValidityPeriodDays < 1 {
		return fmt.Errorf("validity period must be at least 1 day")
	}

	return nil
}

// validateEncryptionKey validates that encryption key can decrypt certificates in backup
// Tests with the first certificate that has encrypted keys
func (s *SetupService) validateEncryptionKey(backup *models.BackupData, encryptionKey []byte) error {
	for _, cert := range backup.Certificates {
		// Find first certificate with encrypted key
		if len(cert.EncryptedKey) > 0 {
			// Try to decrypt the key
			_, err := crypto.DecryptPrivateKey(cert.EncryptedKey, string(encryptionKey))
			if err != nil {
				return fmt.Errorf("encryption key validation failed: unable to decrypt private key. Please verify the encryption key is correct")
			}
			// Successfully decrypted one key, validation passed
			return nil
		}
	}

	// No encrypted keys found in backup (backup was exported without keys)
	// This is not an error condition
	return nil
}

// backupHasEncryptedKeys checks if backup contains any encrypted private keys
func (s *SetupService) backupHasEncryptedKeys(backup *models.BackupData) bool {
	for _, cert := range backup.Certificates {
		if len(cert.EncryptedKey) > 0 {
			return true
		}
	}
	return false
}

// toNullString converts string to sql.NullString
func stringToNullString(s string) sql.NullString {
	return sql.NullString{
		String: s,
		Valid:  s != "",
	}
}
