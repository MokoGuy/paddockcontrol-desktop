package services

import (
	"context"
	"database/sql"
	"fmt"
	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
	"time"
)

// BackupService handles backup export and import operations
type BackupService struct {
	db *db.Database
}

// NewBackupService creates a new backup service
func NewBackupService(database *db.Database) *BackupService {
	return &BackupService{
		db: database,
	}
}

// ExportBackup exports all certificates and configuration to a backup
func (s *BackupService) ExportBackup(ctx context.Context, includeKeys bool) (*models.BackupData, error) {
	// Get all certificates
	certs, err := s.db.Queries().ListAllCertificates(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list certificates: %w", err)
	}

	// Get configuration
	cfg, err := s.db.Queries().GetConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get configuration: %w", err)
	}

	// Convert sqlc.Config to models.Config
	var modelCfg *models.Config
	if cfg != nil {
		modelCfg = &models.Config{
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
		}
	}

	// Build backup data
	backup := &models.BackupData{
		Version:      "1.0",
		ExportedAt:   time.Now().Unix(),
		Config:       modelCfg,
		Certificates: make([]*models.BackupCertificate, len(certs)),
	}

	// Convert certificates
	for i, cert := range certs {
		backupCert := &models.BackupCertificate{
			Hostname:       cert.Hostname,
			PendingCSR:     cert.PendingCSR,
			CertificatePEM: cert.CertificatePEM,
			CreatedAt:      cert.CreatedAt,
			ExpiresAt:      cert.ExpiresAt,
			Note:           cert.Note,
			PendingNote:    cert.PendingNote,
			ReadOnly:       cert.ReadOnly,
		}

		// Include encrypted keys if requested
		if includeKeys {
			backupCert.EncryptedKey = cert.EncryptedKey
			backupCert.PendingEncryptedKey = cert.PendingEncryptedKey
		}

		backup.Certificates[i] = backupCert
	}

	return backup, nil
}

// ImportBackup imports certificates and configuration from a backup
// Enforces strict validation: all certificates must be importable before any are imported
// If backup has encrypted keys, encryptionKey must be correct to decrypt them
func (s *BackupService) ImportBackup(ctx context.Context, backup *models.BackupData, encryptionKey []byte) (*models.ImportResult, error) {
	result := &models.ImportResult{
		Success:   0,
		Skipped:   0,
		Failed:    0,
		Conflicts: []string{},
	}

	// Validate backup format
	if err := s.validateBackup(backup); err != nil {
		return nil, fmt.Errorf("backup validation failed: %w", err)
	}

	// Pre-flight validation: check for conflicts and decrypt ability
	// Ensure all certificates can be imported before importing any
	for _, cert := range backup.Certificates {
		// Check if certificate already exists
		exists, err := s.db.Queries().CertificateExists(ctx, cert.Hostname)
		if err != nil {
			return nil, fmt.Errorf("failed to check certificate existence for %s: %w", cert.Hostname, err)
		}

		if exists {
			return nil, fmt.Errorf("certificate already exists for hostname: %s. Restore aborted", cert.Hostname)
		}

		// If certificate has encrypted key, ensure it can be decrypted
		// This validates the encryption key is correct before importing any certificates
		if len(cert.EncryptedKey) > 0 {
			// Try to decrypt to validate the key works
			_, err := crypto.DecryptPrivateKey(cert.EncryptedKey, string(encryptionKey))
			if err != nil {
				return nil, fmt.Errorf("failed to decrypt private key for %s: encryption key may be incorrect. Restore aborted", cert.Hostname)
			}
		}
	}

	// All pre-flight checks passed, now import all certificates
	for _, cert := range backup.Certificates {
		// Insert certificate
		err := s.db.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
			Hostname:                   cert.Hostname,
			EncryptedPrivateKey:        cert.EncryptedKey,
			PendingCsrPem:              sql.NullString{String: cert.PendingCSR, Valid: cert.PendingCSR != ""},
			PendingEncryptedPrivateKey: cert.PendingEncryptedKey,
			CertificatePem:             sql.NullString{String: cert.CertificatePEM, Valid: cert.CertificatePEM != ""},
			ExpiresAt:                  sql.NullInt64{Int64: *cert.ExpiresAt, Valid: cert.ExpiresAt != nil},
			Note:                       sql.NullString{String: cert.Note, Valid: cert.Note != ""},
			PendingNote:                sql.NullString{String: cert.PendingNote, Valid: cert.PendingNote != ""},
			ReadOnly: func() int64 {
				if cert.ReadOnly {
					return 1
				} else {
					return 0
				}
			}(),
		})

		if err != nil {
			return nil, fmt.Errorf("failed to import certificate %s: %w. Restore aborted", cert.Hostname, err)
		}

		result.Success++
	}

	// Config is handled by SetupService, not here
	// Do not import config during backup restore - it's done at a higher level

	return result, nil
}

// validateBackup validates backup structure and format
func (s *BackupService) validateBackup(backup *models.BackupData) error {
	if backup == nil {
		return fmt.Errorf("backup data is nil")
	}

	if backup.Version == "" {
		return fmt.Errorf("backup version is missing")
	}

	if backup.Certificates == nil {
		return fmt.Errorf("backup certificates list is missing")
	}

	// Validate each certificate has required fields
	for i, cert := range backup.Certificates {
		if cert.Hostname == "" {
			return fmt.Errorf("certificate at index %d has empty hostname", i)
		}
	}

	return nil
}
