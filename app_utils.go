package main

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/logger"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============================================================================
// Utility Methods
// ============================================================================

// CopyToClipboard copies text to system clipboard
func (a *App) CopyToClipboard(text string) error {
	log := logger.WithComponent("app")
	log.Debug("copying to clipboard", slog.Int("bytes", len(text)))

	if err := wailsruntime.ClipboardSetText(a.ctx, text); err != nil {
		log.Error("clipboard copy failed", logger.Err(err))
		return err
	}

	return nil
}

// GetDataDirectory returns the application data directory path
func (a *App) GetDataDirectory() string {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.dataDir
}

// OpenURL opens a URL in the default browser
func (a *App) OpenURL(url string) error {
	wailsruntime.BrowserOpenURL(a.ctx, url)
	return nil
}

// OpenBugReport opens the GitHub issues page for bug reporting
func (a *App) OpenBugReport() error {
	return a.OpenURL("https://github.com/MokoGuy/paddockcontrol-desktop/issues")
}

// OpenDataDirectory opens the data directory in the OS file explorer
func (a *App) OpenDataDirectory() error {
	a.mu.RLock()
	dataDir := a.dataDir
	a.mu.RUnlock()

	log := logger.WithComponent("app")

	if dataDir == "" {
		return fmt.Errorf("data directory not initialized")
	}

	// Verify directory exists
	if _, err := os.Stat(dataDir); os.IsNotExist(err) {
		return fmt.Errorf("data directory does not exist: %s", dataDir)
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", dataDir)
	case "darwin":
		cmd = exec.Command("open", dataDir)
	case "linux":
		cmd = exec.Command("xdg-open", dataDir)
	default:
		return fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}

	if err := cmd.Start(); err != nil {
		log.Error("failed to open data directory", logger.Err(err))
		return fmt.Errorf("failed to open directory: %w", err)
	}

	log.Info("opened data directory in file explorer", slog.String("path", dataDir))
	return nil
}

// GetBuildInfo returns version and build information
func (a *App) GetBuildInfo() map[string]string {
	return map[string]string{
		"version":   Version,
		"buildTime": BuildTime,
		"gitCommit": GitCommit,
		"goVersion": runtime.Version(),
	}
}

// ResetDatabase deletes all data and reinitializes for a fresh start
func (a *App) ResetDatabase() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	_, log := logger.WithOperation(a.ctx, "reset_database")
	log.Info("resetting database - deleting all data")

	// Handle in-memory database differently (for testing)
	if a.dataDir == ":memory:" {
		// For in-memory database, use migrations to reset schema
		if a.db != nil {
			if err := a.db.ResetWithMigrations(); err != nil {
				log.Error("failed to reset in-memory database", logger.Err(err))
				return fmt.Errorf("failed to reset in-memory database: %w", err)
			}
		}
	} else {
		// For file-based database, close and delete files
		if a.db != nil {
			if err := a.db.Close(); err != nil {
				log.Error("failed to close database", logger.Err(err))
			}
			a.db = nil
		}

		// Delete database files
		dbPath := filepath.Join(a.dataDir, "certificates.db")
		filesToDelete := []string{
			dbPath,
			dbPath + "-wal",
			dbPath + "-shm",
		}

		for _, f := range filesToDelete {
			if err := os.Remove(f); err != nil && !os.IsNotExist(err) {
				log.Error("failed to delete file", slog.String("file", f), logger.Err(err))
			} else if err == nil {
				log.Info("deleted file", slog.String("file", f))
			}
		}

		// Reinitialize database
		var err error
		a.db, err = db.NewDatabase(a.dataDir)
		if err != nil {
			log.Error("failed to reinitialize database", logger.Err(err))
			return fmt.Errorf("failed to reinitialize database: %w", err)
		}
	}

	// Clear encryption key from memory
	if a.encryptionKey != nil {
		for i := range a.encryptionKey {
			a.encryptionKey[i] = 0
		}
		a.encryptionKey = nil
	}

	// Reset state to initial values
	a.isConfigured = false
	a.waitingForEncryptionKey = true
	a.encryptionKeyProvided = false

	// Reinitialize services without encryption key
	a.initializeServicesWithoutKey()

	log.Info("database reset complete - ready for fresh setup")

	return nil
}
