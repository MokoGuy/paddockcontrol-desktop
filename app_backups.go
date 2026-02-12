package main

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============================================================================
// Local Backup Operations
// ============================================================================

// ListLocalBackups returns metadata for all local database backup files.
func (a *App) ListLocalBackups() ([]models.LocalBackupInfo, error) {
	a.mu.RLock()
	autoBackup := a.autoBackupService
	a.mu.RUnlock()

	if autoBackup == nil {
		return []models.LocalBackupInfo{}, nil
	}

	return autoBackup.ListBackups()
}

// CreateManualBackup creates a manual database backup snapshot.
func (a *App) CreateManualBackup() error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	log := logger.WithComponent("app")
	log.Info("creating manual backup")

	a.mu.RLock()
	autoBackup := a.autoBackupService
	a.mu.RUnlock()

	if autoBackup == nil {
		return fmt.Errorf("backup service not available")
	}

	_, err := autoBackup.CreateManualBackup()
	if err != nil {
		log.Error("manual backup creation failed", logger.Err(err))
		return err
	}

	wailsruntime.EventsEmit(a.ctx, "backup:created", "manual", "")

	log.Info("manual backup created successfully")
	return nil
}

// RestoreLocalBackup replaces the current database with a local backup file.
// A safety auto-backup is created before the restore operation.
func (a *App) RestoreLocalBackup(filename string) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	log := logger.WithComponent("app")
	log.Info("restoring from local backup", slog.String("filename", filename))

	// Validate filename: only known prefixes, no path traversal
	if strings.Contains(filename, "/") || strings.Contains(filename, "\\") || strings.Contains(filename, "..") {
		return fmt.Errorf("invalid backup filename")
	}
	if !strings.HasPrefix(filename, "certificates.db.autobackup.") &&
		!strings.HasPrefix(filename, "certificates.db.backup.manual.") {
		return fmt.Errorf("invalid backup filename")
	}

	backupPath := filepath.Join(a.dataDir, "backups", filename)
	if _, err := os.Stat(backupPath); os.IsNotExist(err) {
		return fmt.Errorf("backup file not found")
	}

	// Create a safety backup before restore
	if a.autoBackupService != nil {
		if _, err := a.autoBackupService.CreateBackup("restore_local_backup"); err != nil {
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

	if err := copyFile(backupPath, dbPath); err != nil {
		log.Error("failed to copy backup file", logger.Err(err))
		return fmt.Errorf("failed to restore backup: %w", err)
	}

	// Re-initialize the database
	var err error
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

	log.Info("local backup restored successfully", slog.String("filename", filename))
	return nil
}

// DeleteLocalBackup removes a local backup file.
func (a *App) DeleteLocalBackup(filename string) error {
	a.mu.RLock()
	autoBackup := a.autoBackupService
	a.mu.RUnlock()

	if autoBackup == nil {
		return fmt.Errorf("backup service not available")
	}

	return autoBackup.DeleteBackup(filename)
}
