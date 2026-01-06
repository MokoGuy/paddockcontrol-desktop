package services

import (
	"context"
	"fmt"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
)

// SetupService handles initial application setup and configuration
type SetupService struct {
	db            *db.Database
	config        *config.Service
	backupService *BackupService
}

// NewSetupService creates a new setup service
func NewSetupService(database *db.Database, configSvc *config.Service, backupSvc *BackupService) *SetupService {
	return &SetupService{
		db:            database,
		config:        configSvc,
		backupService: backupSvc,
	}
}

// IsConfigured checks if initial setup is complete
func (s *SetupService) IsConfigured(ctx context.Context) (bool, error) {
	return s.config.IsConfigured(ctx)
}

// SetupFromScratch creates a new configuration from scratch
func (s *SetupService) SetupFromScratch(ctx context.Context, req models.SetupRequest) error {
	// Validate setup request
	if err := s.validateSetupRequest(req); err != nil {
		return err
	}

	// Create config record in database
	err := s.db.Queries().CreateConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to create configuration: %w", err)
	}

	// Update config with values from request
	err = s.db.Queries().UpdateConfig(ctx, sqlc.UpdateConfigParams{
		OwnerEmail:                req.OwnerEmail,
		CaName:                    req.CAName,
		HostnameSuffix:            req.HostnameSuffix,
		DefaultOrganization:       req.DefaultOrganization,
		DefaultOrganizationalUnit: toNullString(req.DefaultOrganizationalUnit),
		DefaultCity:               req.DefaultCity,
		DefaultState:              req.DefaultState,
		DefaultCountry:            req.DefaultCountry,
		DefaultKeySize:            int64(req.DefaultKeySize),
		ValidityPeriodDays:        int64(req.ValidityPeriodDays),
		IsConfigured:              1,
	})
	if err != nil {
		return fmt.Errorf("failed to save configuration: %w", err)
	}

	return nil
}

// SetupFromBackup restores application from backup file
// If backup contains encrypted keys, validates encryption key can decrypt them
// If backup lacks encrypted keys, skips key validation
func (s *SetupService) SetupFromBackup(ctx context.Context, backup *models.BackupData, encryptionKey []byte) error {
	if backup == nil {
		return fmt.Errorf("backup data is nil")
	}

	// Check if backup contains encrypted keys
	hasEncryptedKeys := s.backupHasEncryptedKeys(backup)

	// If backup has encrypted keys, validate encryption key can decrypt them
	if hasEncryptedKeys {
		if err := s.validateEncryptionKey(backup, encryptionKey); err != nil {
			return err
		}
	}

	// Import all certificates from backup with strict validation
	importResult, err := s.backupService.ImportBackup(ctx, backup, encryptionKey)
	if err != nil {
		return fmt.Errorf("backup import failed: %w", err)
	}

	// Create config record in database if not exists
	configExists, err := s.db.Queries().ConfigExists(ctx)
	if err != nil {
		return fmt.Errorf("failed to check configuration: %w", err)
	}

	if !configExists {
		err = s.db.Queries().CreateConfig(ctx)
		if err != nil {
			return fmt.Errorf("failed to create configuration: %w", err)
		}
	}

	// Update config with backup values, overwriting any existing config
	if backup.Config != nil {
		err = s.db.Queries().UpdateConfig(ctx, sqlc.UpdateConfigParams{
			OwnerEmail:                backup.Config.OwnerEmail,
			CaName:                    backup.Config.CAName,
			HostnameSuffix:            backup.Config.HostnameSuffix,
			DefaultOrganization:       backup.Config.DefaultOrganization,
			DefaultOrganizationalUnit: toNullString(backup.Config.DefaultOrganizationalUnit),
			DefaultCity:               backup.Config.DefaultCity,
			DefaultState:              backup.Config.DefaultState,
			DefaultCountry:            backup.Config.DefaultCountry,
			DefaultKeySize:            int64(backup.Config.DefaultKeySize),
			ValidityPeriodDays:        int64(backup.Config.ValidityPeriodDays),
			IsConfigured:              1,
		})
		if err != nil {
			return fmt.Errorf("failed to update configuration: %w", err)
		}
	} else {
		// Mark as configured even if backup has no config
		err = s.config.SetConfigured(ctx)
		if err != nil {
			return fmt.Errorf("failed to mark as configured: %w", err)
		}
	}

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
func toNullString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
