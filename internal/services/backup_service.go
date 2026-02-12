package services

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"
	"time"
)

// BackupService handles backup export and import operations
type BackupService struct {
	db      *db.Database
	history *HistoryService
	log     *slog.Logger
}

// NewBackupService creates a new backup service
func NewBackupService(database *db.Database) *BackupService {
	return &BackupService{
		db:      database,
		history: NewHistoryService(database),
		log:     logger.WithComponent("backup"),
	}
}

// ExportBackup exports all certificates and configuration to a backup
func (s *BackupService) ExportBackup(ctx context.Context, includeKeys bool) (*models.BackupData, error) {
	ctx, log := logger.WithOperation(ctx, "backup_export")
	log.Info("starting backup export", slog.Bool("include_keys", includeKeys))

	// Get all certificates
	certs, err := s.db.Queries().ListAllCertificates(ctx)
	if err != nil {
		log.Error("failed to list certificates", logger.Err(err))
		return nil, fmt.Errorf("failed to list certificates: %w", err)
	}
	log.Debug("retrieved certificates", slog.Int("count", len(certs)))

	// Get configuration
	cfg, err := s.db.Queries().GetConfig(ctx)
	if err != nil {
		log.Error("failed to get configuration", logger.Err(err))
		return nil, fmt.Errorf("failed to get configuration: %w", err)
	}

	// Convert sqlc.Config to models.Config
	var modelCfg *models.Config
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

	// Build backup data
	backup := &models.BackupData{
		Version:      "1.0",
		ExportedAt:   time.Now().Unix(),
		Config:       modelCfg,
		Certificates: make([]*models.BackupCertificate, len(certs)),
	}

	// Convert certificates
	keysIncludedCount := 0
	for i, cert := range certs {
		var expiresAt *int64
		if cert.ExpiresAt.Valid {
			expiresAt = &cert.ExpiresAt.Int64
		}

		var note string
		if cert.Note.Valid {
			note = cert.Note.String
		}

		var pendingNote string
		if cert.PendingNote.Valid {
			pendingNote = cert.PendingNote.String
		}

		var pendingCSR string
		if cert.PendingCsrPem.Valid {
			pendingCSR = cert.PendingCsrPem.String
		}

		var certificatePEM string
		if cert.CertificatePem.Valid {
			certificatePEM = cert.CertificatePem.String
		}

		backupCert := &models.BackupCertificate{
			Hostname:       cert.Hostname,
			PendingCSR:     pendingCSR,
			CertificatePEM: certificatePEM,
			CreatedAt:      cert.CreatedAt,
			ExpiresAt:      expiresAt,
			Note:           note,
			PendingNote:    pendingNote,
			ReadOnly:       cert.ReadOnly == 1,
		}

		// Include encrypted keys if requested
		if includeKeys {
			backupCert.EncryptedKey = cert.EncryptedPrivateKey
			backupCert.PendingEncryptedKey = cert.PendingEncryptedPrivateKey
			if len(cert.EncryptedPrivateKey) > 0 || len(cert.PendingEncryptedPrivateKey) > 0 {
				keysIncludedCount++
			}
		}

		backup.Certificates[i] = backupCert
	}

	log.Info("backup export completed",
		slog.Int("certificates", len(certs)),
		slog.Bool("keys_included", includeKeys),
		slog.Int("keys_count", keysIncludedCount),
	)

	return backup, nil
}

// ImportBackup imports certificates and configuration from a backup
// Enforces strict validation: all certificates must be importable before any are imported
// If backup has encrypted keys, encryptionKey must be correct to decrypt them
func (s *BackupService) ImportBackup(ctx context.Context, backup *models.BackupData, encryptionKey []byte) (*models.ImportResult, error) {
	ctx, log := logger.WithOperation(ctx, "backup_import")

	// Validate backup format before accessing fields
	if err := s.validateBackup(backup); err != nil {
		log.Error("backup validation failed", logger.Err(err))
		return nil, fmt.Errorf("backup validation failed: %w", err)
	}

	log.Info("starting backup import",
		slog.String("version", backup.Version),
		slog.Int("certificates", len(backup.Certificates)),
	)

	result := &models.ImportResult{
		Success:   0,
		Skipped:   0,
		Failed:    0,
		Conflicts: []string{},
	}

	log.Debug("backup format validated")

	// Pre-flight validation: check for conflicts and decrypt ability
	// Ensure all certificates can be imported before importing any
	log.Debug("starting pre-flight validation")
	for _, cert := range backup.Certificates {
		certLog := logger.WithHostname(log, cert.Hostname)

		// Check if certificate already exists
		exists, err := s.db.Queries().CertificateExists(ctx, cert.Hostname)
		if err != nil {
			certLog.Error("failed to check certificate existence", logger.Err(err))
			return nil, fmt.Errorf("failed to check certificate existence for %s: %w", cert.Hostname, err)
		}

		if exists == 1 {
			certLog.Error("certificate already exists, aborting restore")
			return nil, fmt.Errorf("certificate already exists for hostname: %s. Restore aborted", cert.Hostname)
		}

		// If certificate has encrypted key, ensure it can be decrypted
		// This validates the encryption key is correct before importing any certificates
		if len(cert.EncryptedKey) > 0 {
			certLog.Debug("validating encrypted key decryption")
			// Try to decrypt to validate the key works
			_, err := crypto.DecryptPrivateKey(cert.EncryptedKey, encryptionKey)
			if err != nil {
				certLog.Error("failed to decrypt private key, encryption key may be incorrect", logger.Err(err))
				return nil, fmt.Errorf("failed to decrypt private key for %s: encryption key may be incorrect. Restore aborted", cert.Hostname)
			}
		}
	}
	log.Debug("pre-flight validation passed")

	// All pre-flight checks passed, now import all certificates
	log.Info("importing certificates")
	for _, cert := range backup.Certificates {
		certLog := logger.WithHostname(log, cert.Hostname)

		// Insert certificate
		err := s.db.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
			Hostname:                   cert.Hostname,
			EncryptedPrivateKey:        cert.EncryptedKey,
			PendingCsrPem:              sql.NullString{String: cert.PendingCSR, Valid: cert.PendingCSR != ""},
			PendingEncryptedPrivateKey: cert.PendingEncryptedKey,
			CertificatePem:             sql.NullString{String: cert.CertificatePEM, Valid: cert.CertificatePEM != ""},
			ExpiresAt: func() sql.NullInt64 {
				if cert.ExpiresAt != nil {
					return sql.NullInt64{Int64: *cert.ExpiresAt, Valid: true}
				}
				return sql.NullInt64{}
			}(),
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
			certLog.Error("failed to import certificate", logger.Err(err))
			return nil, fmt.Errorf("failed to import certificate %s: %w. Restore aborted", cert.Hostname, err)
		}

		// Log history entry for restored certificate
		message := "Certificate restored from backup"
		if cert.ExpiresAt != nil {
			expiresDate := time.Unix(*cert.ExpiresAt, 0).Format("2006-01-02")
			message = fmt.Sprintf("Certificate restored from backup (expires %s)", expiresDate)
		} else if cert.PendingCSR != "" {
			message = "Pending CSR restored from backup"
		}
		_ = s.history.LogEvent(ctx, cert.Hostname, models.EventCertificateRestored, message)

		certLog.Debug("certificate imported successfully")
		result.Success++
	}

	// Config is handled by SetupService, not here
	// Do not import config during backup restore - it's done at a higher level

	log.Info("backup import completed",
		slog.Int("imported", result.Success),
		slog.Int("skipped", result.Skipped),
	)

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
