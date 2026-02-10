package services

import (
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"
)

const (
	// DefaultMaxAutoBackups is the maximum number of automatic backups to retain
	DefaultMaxAutoBackups = 5

	// autoBackupPrefix is the prefix used for auto-backup files
	autoBackupPrefix = "certificates.db.autobackup."

	// manualBackupPrefix is the prefix used for manual backup files
	manualBackupPrefix = "certificates.db.backup.manual."

	// timestampFormat is the Go time format used in backup filenames
	timestampFormat = "20060102T150405"
)

// AutoBackupService handles automatic database backups before destructive operations
type AutoBackupService struct {
	db         *sql.DB
	dataDir    string
	backupsDir string
	maxKeep    int
	log        *slog.Logger
}

// NewAutoBackupService creates a new auto-backup service
func NewAutoBackupService(db *sql.DB, dataDir string) *AutoBackupService {
	log := logger.WithComponent("autobackup")
	backupsDir := filepath.Join(dataDir, "backups")

	if err := os.MkdirAll(backupsDir, 0700); err != nil {
		log.Error("failed to create backups directory", logger.Err(err))
	}

	s := &AutoBackupService{
		db:         db,
		dataDir:    dataDir,
		backupsDir: backupsDir,
		maxKeep:    DefaultMaxAutoBackups,
		log:        log,
	}

	// Migrate any existing backup files from the old location (dataDir) to backupsDir
	s.migrateOldBackups()

	return s
}

// CreateBackup creates a consistent snapshot of the database file using VACUUM INTO.
// The operation parameter is used for logging context (e.g., "upload_certificate").
// Errors are returned so callers can log them, but callers should not block on errors.
func (s *AutoBackupService) CreateBackup(operation string) (string, error) {
	timestamp := time.Now().Format(timestampFormat)
	backupName := autoBackupPrefix + timestamp
	backupPath := filepath.Join(s.backupsDir, backupName)

	s.log.Info("creating auto-backup",
		slog.String("operation", operation),
		slog.String("path", backupPath),
	)

	// VACUUM INTO produces a consistent, self-contained copy that works correctly
	// with WAL mode without needing to copy .wal/.shm files or force a checkpoint.
	// The path is constructed internally from dataDir (not user input), so this is safe.
	_, err := s.db.Exec(fmt.Sprintf(`VACUUM INTO '%s'`, backupPath))
	if err != nil {
		s.log.Error("auto-backup failed",
			slog.String("operation", operation),
			logger.Err(err),
		)
		return "", fmt.Errorf("auto-backup failed: %w", err)
	}

	s.log.Info("auto-backup created successfully",
		slog.String("operation", operation),
		slog.String("path", backupPath),
	)

	// Rotate old backups (best-effort, errors logged but not returned)
	s.rotateBackups()

	return backupPath, nil
}

// rotateBackups removes the oldest backups if count exceeds maxKeep
func (s *AutoBackupService) rotateBackups() {
	pattern := filepath.Join(s.backupsDir, autoBackupPrefix+"*")
	matches, err := filepath.Glob(pattern)
	if err != nil {
		s.log.Error("failed to list auto-backups for rotation", logger.Err(err))
		return
	}

	if len(matches) <= s.maxKeep {
		return
	}

	// Sort ascending by name (timestamp is embedded, so alphabetical = chronological)
	sort.Strings(matches)

	// Remove oldest (those beyond maxKeep)
	toRemove := matches[:len(matches)-s.maxKeep]
	for _, path := range toRemove {
		if err := os.Remove(path); err != nil {
			s.log.Error("failed to remove old auto-backup",
				slog.String("path", path),
				logger.Err(err),
			)
		} else {
			s.log.Info("removed old auto-backup", slog.String("path", path))
		}
	}
}

// CreateManualBackup creates a user-initiated database backup snapshot.
// Manual backups are not subject to automatic rotation.
func (s *AutoBackupService) CreateManualBackup() (string, error) {
	timestamp := time.Now().Format(timestampFormat)
	backupName := manualBackupPrefix + timestamp
	backupPath := filepath.Join(s.backupsDir, backupName)

	s.log.Info("creating manual backup", slog.String("path", backupPath))

	_, err := s.db.Exec(fmt.Sprintf(`VACUUM INTO '%s'`, backupPath))
	if err != nil {
		s.log.Error("manual backup failed", logger.Err(err))
		return "", fmt.Errorf("manual backup failed: %w", err)
	}

	s.log.Info("manual backup created successfully", slog.String("path", backupPath))
	return backupPath, nil
}

// ListBackups returns metadata for all local backup files (both auto and manual).
// Results are sorted by timestamp descending (newest first).
func (s *AutoBackupService) ListBackups() ([]models.LocalBackupInfo, error) {
	var results []models.LocalBackupInfo

	prefixes := []struct {
		prefix     string
		backupType string
	}{
		{autoBackupPrefix, "auto"},
		{manualBackupPrefix, "manual"},
	}

	for _, p := range prefixes {
		pattern := filepath.Join(s.backupsDir, p.prefix+"*")
		matches, err := filepath.Glob(pattern)
		if err != nil {
			s.log.Error("failed to list backups", logger.Err(err))
			return nil, fmt.Errorf("failed to list backups: %w", err)
		}

		for _, match := range matches {
			info, err := os.Stat(match)
			if err != nil {
				s.log.Error("failed to stat backup file",
					slog.String("path", match), logger.Err(err))
				continue
			}

			filename := filepath.Base(match)
			timestampStr := strings.TrimPrefix(filename, p.prefix)

			t, err := time.Parse(timestampFormat, timestampStr)
			if err != nil {
				s.log.Error("failed to parse backup timestamp",
					slog.String("filename", filename), logger.Err(err))
				continue
			}

			certCount, caName := s.peekBackupContent(match)

			results = append(results, models.LocalBackupInfo{
				Filename:         filename,
				Type:             p.backupType,
				Timestamp:        t.Unix(),
				Size:             info.Size(),
				CertificateCount: certCount,
				CAName:           caName,
			})
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Timestamp > results[j].Timestamp
	})

	return results, nil
}

// peekBackupContent opens a backup SQLite file read-only and extracts summary info.
// Errors are non-fatal; zero values are returned on failure.
func (s *AutoBackupService) peekBackupContent(path string) (certCount int, caName string) {
	db, err := sql.Open("sqlite", path+"?mode=ro&_journal_mode=OFF")
	if err != nil {
		return 0, ""
	}
	defer db.Close()

	_ = db.QueryRow("SELECT COUNT(*) FROM certificates").Scan(&certCount)
	_ = db.QueryRow("SELECT ca_name FROM config WHERE id = 1").Scan(&caName)

	return certCount, caName
}

// DeleteBackup removes a local backup file.
// Only files matching known backup prefixes are allowed.
func (s *AutoBackupService) DeleteBackup(filename string) error {
	if !strings.HasPrefix(filename, autoBackupPrefix) &&
		!strings.HasPrefix(filename, manualBackupPrefix) {
		return fmt.Errorf("invalid backup filename")
	}

	if strings.Contains(filename, "/") || strings.Contains(filename, "\\") || strings.Contains(filename, "..") {
		return fmt.Errorf("invalid backup filename")
	}

	backupPath := filepath.Join(s.backupsDir, filename)

	if _, err := os.Stat(backupPath); os.IsNotExist(err) {
		return fmt.Errorf("backup file not found")
	}

	if err := os.Remove(backupPath); err != nil {
		s.log.Error("failed to delete backup",
			slog.String("path", backupPath), logger.Err(err))
		return fmt.Errorf("failed to delete backup: %w", err)
	}

	s.log.Info("backup deleted", slog.String("filename", filename))
	return nil
}

// migrateOldBackups moves backup files from the old location (dataDir) to the new backupsDir.
func (s *AutoBackupService) migrateOldBackups() {
	for _, prefix := range []string{autoBackupPrefix, manualBackupPrefix} {
		pattern := filepath.Join(s.dataDir, prefix+"*")
		matches, err := filepath.Glob(pattern)
		if err != nil {
			s.log.Error("failed to scan for old backups", logger.Err(err))
			continue
		}

		for _, oldPath := range matches {
			filename := filepath.Base(oldPath)
			newPath := filepath.Join(s.backupsDir, filename)

			if err := os.Rename(oldPath, newPath); err != nil {
				s.log.Error("failed to migrate backup",
					slog.String("from", oldPath),
					slog.String("to", newPath),
					logger.Err(err),
				)
			} else {
				s.log.Info("migrated backup to backups directory",
					slog.String("filename", filename),
				)
			}
		}
	}
}
