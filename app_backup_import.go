package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db"
	dbsqlc "paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============================================================================
// Backup Import Operations
// ============================================================================

// PeekBackupInfo opens a backup DB file read-only and returns a summary of its contents.
func (a *App) PeekBackupInfo(path string) (*models.BackupPeekInfo, error) {
	log := logger.WithComponent("app")
	log.Info("peeking backup info", slog.String("path", path))

	if err := validateBackupPath(path); err != nil {
		return nil, err
	}

	backupDB, err := openBackupDB(path)
	if err != nil {
		return nil, err
	}
	defer backupDB.Close()

	info := &models.BackupPeekInfo{}

	// Get certificate count and hostnames
	rows, err := backupDB.Query("SELECT hostname FROM certificates ORDER BY hostname")
	if err != nil {
		log.Error("failed to query backup certificates", logger.Err(err))
		return nil, fmt.Errorf("failed to read backup certificates: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var hostname string
		if err := rows.Scan(&hostname); err != nil {
			return nil, fmt.Errorf("failed to scan hostname: %w", err)
		}
		info.Hostnames = append(info.Hostnames, hostname)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate hostnames: %w", err)
	}
	info.CertificateCount = len(info.Hostnames)

	// Get CA name from config
	var caName sql.NullString
	err = backupDB.QueryRow("SELECT ca_name FROM config WHERE is_configured = 1 LIMIT 1").Scan(&caName)
	if err == nil && caName.Valid {
		info.CAName = caName.String
	}

	// Check if security_keys table has entries
	var keyCount int
	err = backupDB.QueryRow("SELECT COUNT(*) FROM security_keys").Scan(&keyCount)
	if err == nil {
		info.HasSecurityKeys = keyCount > 0
	}

	if info.Hostnames == nil {
		info.Hostnames = []string{}
	}

	log.Info("backup peek complete",
		slog.Int("certificates", info.CertificateCount),
		slog.String("ca_name", info.CAName),
		slog.Bool("has_security_keys", info.HasSecurityKeys),
	)

	return info, nil
}

// ImportCertificatesFromBackup selectively imports certificates from a backup DB file.
// Requires the app to be unlocked. Decrypts keys with the backup's master key and
// re-encrypts them with the current master key.
func (a *App) ImportCertificatesFromBackup(backupPath string, backupPassword string) (*models.CertImportResult, error) {
	if err := a.requireUnlocked(); err != nil {
		return nil, err
	}

	_, log := logger.WithOperation(a.ctx, "import_certificates")
	log.Info("importing certificates from backup", slog.String("path", backupPath))

	if err := validateBackupPath(backupPath); err != nil {
		return nil, err
	}

	// Open backup DB read-only
	backupDB, err := openBackupDB(backupPath)
	if err != nil {
		return nil, err
	}
	defer backupDB.Close()

	// Get backup's master key by unwrapping with the provided password
	backupMasterKey, err := unwrapBackupMasterKey(backupDB, backupPassword)
	if err != nil {
		log.Error("failed to unwrap backup master key", logger.Err(err))
		return nil, fmt.Errorf("wrong password or invalid backup: %w", err)
	}

	// Get current master key
	a.mu.RLock()
	currentMasterKey := make([]byte, len(a.masterKey))
	copy(currentMasterKey, a.masterKey)
	a.mu.RUnlock()

	// Read all certificates from backup
	rows, err := backupDB.Query(`
		SELECT hostname, encrypted_private_key, pending_csr_pem, certificate_pem,
		       pending_encrypted_private_key, created_at, expires_at, note, pending_note, read_only
		FROM certificates
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to read backup certificates: %w", err)
	}
	defer rows.Close()

	type backupCert struct {
		hostname            string
		encryptedKey        []byte
		pendingCSR          sql.NullString
		certificatePEM      sql.NullString
		pendingEncryptedKey []byte
		createdAt           int64
		expiresAt           sql.NullInt64
		note                sql.NullString
		pendingNote         sql.NullString
		readOnly            int64
	}

	var certs []backupCert
	for rows.Next() {
		var c backupCert
		if err := rows.Scan(
			&c.hostname, &c.encryptedKey, &c.pendingCSR, &c.certificatePEM,
			&c.pendingEncryptedKey, &c.createdAt, &c.expiresAt, &c.note, &c.pendingNote, &c.readOnly,
		); err != nil {
			return nil, fmt.Errorf("failed to scan certificate: %w", err)
		}
		certs = append(certs, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate certificates: %w", err)
	}

	a.performAutoBackup("import_certificates")

	result := &models.CertImportResult{
		Conflicts: []string{},
	}

	a.mu.RLock()
	database := a.db
	a.mu.RUnlock()

	for _, cert := range certs {
		certLog := log.With(slog.String("hostname", cert.hostname))

		// Check for hostname conflicts
		exists, err := database.Queries().CertificateExists(a.ctx, cert.hostname)
		if err != nil {
			return nil, fmt.Errorf("failed to check certificate existence for %s: %w", cert.hostname, err)
		}
		if exists == 1 {
			certLog.Debug("skipping duplicate hostname")
			result.Skipped++
			result.Conflicts = append(result.Conflicts, cert.hostname)
			continue
		}

		// Re-encrypt keys: decrypt with backup master key, encrypt with current master key
		var newEncryptedKey []byte
		if len(cert.encryptedKey) > 0 {
			plaintext, err := crypto.DecryptPrivateKey(cert.encryptedKey, backupMasterKey)
			if err != nil {
				certLog.Error("failed to decrypt private key from backup", logger.Err(err))
				return nil, fmt.Errorf("failed to decrypt private key for %s: %w", cert.hostname, err)
			}
			newEncryptedKey, err = crypto.EncryptPrivateKey(plaintext, currentMasterKey)
			if err != nil {
				return nil, fmt.Errorf("failed to re-encrypt private key for %s: %w", cert.hostname, err)
			}
		}

		var newPendingEncryptedKey []byte
		if len(cert.pendingEncryptedKey) > 0 {
			plaintext, err := crypto.DecryptPrivateKey(cert.pendingEncryptedKey, backupMasterKey)
			if err != nil {
				certLog.Error("failed to decrypt pending private key from backup", logger.Err(err))
				return nil, fmt.Errorf("failed to decrypt pending private key for %s: %w", cert.hostname, err)
			}
			newPendingEncryptedKey, err = crypto.EncryptPrivateKey(plaintext, currentMasterKey)
			if err != nil {
				return nil, fmt.Errorf("failed to re-encrypt pending private key for %s: %w", cert.hostname, err)
			}
		}

		// Insert into current database
		err = database.Queries().CreateCertificate(a.ctx, dbsqlc.CreateCertificateParams{
			Hostname:                   cert.hostname,
			EncryptedPrivateKey:        newEncryptedKey,
			PendingCsrPem:              cert.pendingCSR,
			PendingEncryptedPrivateKey: newPendingEncryptedKey,
			CertificatePem:             cert.certificatePEM,
			ExpiresAt:                  cert.expiresAt,
			Note:                       cert.note,
			PendingNote:                cert.pendingNote,
			ReadOnly:                   cert.readOnly,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to insert certificate %s: %w", cert.hostname, err)
		}

		certLog.Debug("certificate imported")
		result.Imported++
	}

	log.Info("certificate import completed",
		slog.Int("imported", result.Imported),
		slog.Int("skipped", result.Skipped),
		slog.Int("conflicts", len(result.Conflicts)),
	)

	return result, nil
}

// RestoreFromBackupFile replaces the current database with a backup file selected by the user.
// Unlike RestoreLocalBackup, this accepts any valid .db file path (not just local backup files).
func (a *App) RestoreFromBackupFile(path string) error {
	log := logger.WithComponent("app")
	log.Info("restoring from backup file", slog.String("path", path))

	if err := validateBackupPath(path); err != nil {
		return err
	}

	// Validate it's a valid SQLite database by trying to open and query it
	testDB, err := openBackupDB(path)
	if err != nil {
		return fmt.Errorf("invalid backup file: %w", err)
	}
	testDB.Close()

	a.mu.Lock()
	defer a.mu.Unlock()

	// Create a safety backup before restore
	if a.autoBackupService != nil {
		if _, err := a.autoBackupService.CreateBackup("restore_from_file"); err != nil {
			log.Error("pre-restore safety backup failed", logger.Err(err))
			// Continue — the user explicitly chose to restore
		}
	}

	// Close the current database connection
	if a.db != nil {
		if err := a.db.Close(); err != nil {
			log.Error("failed to close database", logger.Err(err))
		}
		a.db = nil
	}

	// Replace the database file
	dbPath := filepath.Join(a.dataDir, "certificates.db")
	os.Remove(dbPath + "-wal")
	os.Remove(dbPath + "-shm")

	if err := copyFile(path, dbPath); err != nil {
		log.Error("failed to copy backup file", logger.Err(err))
		return fmt.Errorf("failed to restore backup: %w", err)
	}

	// Re-initialize the database
	a.db, err = db.NewDatabase(a.dataDir)
	if err != nil {
		log.Error("failed to reinitialize database after restore", logger.Err(err))
		return fmt.Errorf("failed to reinitialize database: %w", err)
	}

	// Re-check configuration state
	tmpConfigService := config.NewService(a.db)
	a.isConfigured, err = tmpConfigService.IsConfigured(a.ctx)
	if err != nil {
		log.Error("configuration check failed after restore", logger.Err(err))
	}

	// Clear encryption key — restored DB may not match in-memory key
	if a.masterKey != nil {
		for i := range a.masterKey {
			a.masterKey[i] = 0
		}
		a.masterKey = nil
	}
	a.isUnlocked = false
	a.waitingForEncryptionKey = false

	// Re-initialize all services
	a.initializeServicesWithoutKey()

	log.Info("backup file restored successfully", slog.String("path", path))
	return nil
}

// SelectBackupFile opens a file dialog for the user to select a .db backup file.
// Returns the selected file path, or empty string if cancelled.
func (a *App) SelectBackupFile() (string, error) {
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Select Backup File",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "Database Files (*.db)", Pattern: "*.db"},
			{DisplayName: "All Files (*.*)", Pattern: "*.*"},
		},
	})
	if err != nil {
		return "", fmt.Errorf("file dialog error: %w", err)
	}
	return path, nil
}

// ============================================================================
// Internal helpers
// ============================================================================

// validateBackupPath checks that the backup path is valid and the file exists.
func validateBackupPath(path string) error {
	if path == "" {
		return fmt.Errorf("backup path is empty")
	}
	if strings.Contains(path, "..") {
		return fmt.Errorf("invalid backup path")
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return fmt.Errorf("backup file not found")
	}
	return nil
}

// openBackupDB opens a SQLite database file in read-only mode and validates it.
func openBackupDB(path string) (*sql.DB, error) {
	backupDB, err := sql.Open("sqlite", path+"?mode=ro&_journal_mode=OFF")
	if err != nil {
		return nil, fmt.Errorf("failed to open backup database: %w", err)
	}

	// Validate by querying the certificates table
	var count int
	if err := backupDB.QueryRow("SELECT COUNT(*) FROM certificates").Scan(&count); err != nil {
		backupDB.Close()
		return nil, fmt.Errorf("invalid backup database (missing certificates table): %w", err)
	}

	return backupDB, nil
}

// unwrapBackupMasterKey reads the security_keys table from a backup DB and tries to
// unwrap the master key using the provided password.
func unwrapBackupMasterKey(backupDB *sql.DB, password string) ([]byte, error) {
	rows, err := backupDB.Query(
		"SELECT wrapped_master_key, metadata FROM security_keys WHERE method = ?",
		models.SecurityKeyMethodPassword,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query security keys: %w", err)
	}
	defer rows.Close()

	found := false
	for rows.Next() {
		found = true
		var wrappedKey []byte
		var metadataStr sql.NullString
		if err := rows.Scan(&wrappedKey, &metadataStr); err != nil {
			return nil, fmt.Errorf("failed to scan security key: %w", err)
		}

		if !metadataStr.Valid {
			continue
		}

		var metadata models.PasswordMetadata
		if err := json.Unmarshal([]byte(metadataStr.String), &metadata); err != nil {
			continue
		}

		params := crypto.Argon2idParams{
			Memory:      metadata.Argon2Memory,
			Iterations:  metadata.Argon2Iterations,
			Parallelism: metadata.Argon2Parallelism,
			KeyLength:   32,
			SaltLength:  uint32(len(metadata.Salt)),
		}

		wrappingKey := crypto.DeriveKeyFromPassword(password, metadata.Salt, params)
		masterKey, err := crypto.UnwrapMasterKey(wrappedKey, wrappingKey)
		if err != nil {
			continue // Wrong password for this entry
		}

		return masterKey, nil
	}

	if !found {
		return nil, fmt.Errorf("backup has no password unlock methods")
	}

	return nil, fmt.Errorf("invalid password")
}
