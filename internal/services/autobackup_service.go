package services

import (
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"time"

	"paddockcontrol-desktop/internal/logger"
)

const (
	// DefaultMaxAutoBackups is the maximum number of automatic backups to retain
	DefaultMaxAutoBackups = 5

	// autoBackupPrefix is the prefix used for auto-backup files
	autoBackupPrefix = "certificates.db.autobackup."
)

// AutoBackupService handles automatic database backups before destructive operations
type AutoBackupService struct {
	db      *sql.DB
	dataDir string
	maxKeep int
	log     *slog.Logger
}

// NewAutoBackupService creates a new auto-backup service
func NewAutoBackupService(db *sql.DB, dataDir string) *AutoBackupService {
	return &AutoBackupService{
		db:      db,
		dataDir: dataDir,
		maxKeep: DefaultMaxAutoBackups,
		log:     logger.WithComponent("autobackup"),
	}
}

// CreateBackup creates a consistent snapshot of the database file using VACUUM INTO.
// The operation parameter is used for logging context (e.g., "upload_certificate").
// Errors are returned so callers can log them, but callers should not block on errors.
func (s *AutoBackupService) CreateBackup(operation string) (string, error) {
	timestamp := time.Now().Format("20060102T150405")
	backupName := autoBackupPrefix + timestamp
	backupPath := filepath.Join(s.dataDir, backupName)

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
	pattern := filepath.Join(s.dataDir, autoBackupPrefix+"*")
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
