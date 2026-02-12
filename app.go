package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"sync"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/services"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct represents the main application
type App struct {
	ctx context.Context
	mu  sync.RWMutex

	// Database and services
	db                 *db.Database
	certificateService *services.CertificateService
	autoBackupService  *services.AutoBackupService
	setupService       *services.SetupService
	configService      *config.Service
	updateService      *services.UpdateService

	// Runtime state
	masterKey               []byte // 32-byte random master key (encrypts all cert private keys)
	waitingForEncryptionKey bool
	isUnlocked              bool // true when master key is in memory (app is unlocked)
	isConfigured            bool
	needsMigration          bool // true if legacy SHA-256 encrypted certs exist without security_keys
	dataDir                 string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Get application data directory
	dataDir, err := a.getDataDirectory()
	if err != nil {
		a.showFatalError("Initialization Error",
			fmt.Sprintf("Failed to get data directory: %v", err))
		return
	}
	a.dataDir = dataDir

	// Initialize logger
	if err := logger.Initialize(dataDir, ProductionMode); err != nil {
		a.showFatalError("Logging Error",
			fmt.Sprintf("Failed to initialize logger: %v", err))
		return
	}

	log := logger.WithComponent("app")
	log.Info("application starting",
		slog.String("version", Version),
		slog.String("data_dir", dataDir),
		slog.Bool("production", ProductionMode),
	)

	// Initialize database
	a.db, err = db.NewDatabase(dataDir)
	if err != nil {
		log.Error("database initialization failed", logger.Err(err))
		a.showFatalError("Database Error",
			fmt.Sprintf("Failed to initialize database: %v", err))
		return
	}
	log.Info("database initialized successfully")

	// Check if configured
	tmpConfigService := config.NewService(a.db)
	a.isConfigured, err = tmpConfigService.IsConfigured(ctx)
	if err != nil {
		log.Error("configuration check failed", logger.Err(err))
		a.showFatalError("Configuration Error",
			fmt.Sprintf("Failed to check configuration: %v", err))
		return
	}
	log.Info("configuration status", slog.Bool("configured", a.isConfigured))

	// Detect if migration from legacy SHA-256 format is needed
	hasSecurityKeys, err := a.db.Queries().HasAnySecurityKeys(ctx)
	if err != nil {
		log.Error("failed to check security keys", logger.Err(err))
	}
	if a.isConfigured && hasSecurityKeys == 0 {
		// Configured app with no security_keys — may need migration if encrypted certs exist
		a.needsMigration = true
		log.Info("legacy encryption detected - migration will run on first unlock")
	}

	// Initialize services without encryption key (for setup/restore to work)
	a.initializeServicesWithoutKey()
	log.Info("services initialized without encryption key")

	// Auto-skip encryption key at startup (limited mode by default)
	// Users can provide key anytime via Settings
	a.waitingForEncryptionKey = false
	a.isUnlocked = false
	log.Info("starting in limited mode - password can be provided via Settings")
}

// domReady is called when the frontend DOM is ready
func (a *App) domReady(ctx context.Context) {
	log := logger.WithComponent("app")
	log.Info("DOM ready, emitting wails:ready event")
	wailsruntime.EventsEmit(ctx, "wails:ready")

	// Check for updates in the background (production only)
	a.startBackgroundUpdateCheck(ctx)
}

// shutdown is called when the app exits
func (a *App) shutdown(ctx context.Context) {
	log := logger.WithComponent("app")
	log.Info("application shutting down")

	if a.db != nil {
		if err := a.db.Close(); err != nil {
			log.Error("database close error", logger.Err(err))
		} else {
			log.Info("database closed successfully")
		}
	}

	// Clear master key from memory
	if len(a.masterKey) > 0 {
		for i := range a.masterKey {
			a.masterKey[i] = 0
		}
		a.masterKey = nil
		log.Info("master key cleared from memory")
	}

	log.Info("application shutdown complete")
}

// getDataDirectory returns the platform-specific data directory
// Supports PADDOCKCONTROL_DATA_DIR env var override for testing
func (a *App) getDataDirectory() (string, error) {
	// Check for environment variable override (useful for testing)
	if envDir := os.Getenv("PADDOCKCONTROL_DATA_DIR"); envDir != "" {
		// Skip directory creation for in-memory mode (testing)
		if envDir != ":memory:" {
			if err := os.MkdirAll(envDir, 0700); err != nil {
				return "", fmt.Errorf("failed to create data directory: %w", err)
			}
		}
		return envDir, nil
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get user home directory: %w", err)
	}

	var dataDir string
	switch runtime.GOOS {
	case "windows":
		dataDir = filepath.Join(os.Getenv("APPDATA"), "PaddockControl")
	case "linux":
		dataDir = filepath.Join(homeDir, ".local", "share", "paddockcontrol")
	default:
		return "", fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}

	// Create directory if not exists
	if err := os.MkdirAll(dataDir, 0700); err != nil {
		return "", fmt.Errorf("failed to create data directory: %w", err)
	}

	return dataDir, nil
}

// showFatalError displays a fatal error dialog
func (a *App) showFatalError(title, message string) {
	log := logger.WithComponent("app")
	log.Error("FATAL ERROR", slog.String("title", title), slog.String("message", message))
	wailsruntime.MessageDialog(a.ctx, wailsruntime.MessageDialogOptions{
		Type:    wailsruntime.ErrorDialog,
		Title:   title,
		Message: message,
	})
}

// initializeServicesWithoutKey initializes services for read-only access
func (a *App) initializeServicesWithoutKey() {
	a.configService = config.NewService(a.db)
	a.certificateService = services.NewCertificateService(a.db, a.configService)
	a.setupService = services.NewSetupService(a.db, a.configService)
	if a.dataDir != ":memory:" {
		a.autoBackupService = services.NewAutoBackupService(a.db.DB(), a.dataDir)
	}
	a.updateService = services.NewUpdateService(Version, a.db)

	log := logger.WithComponent("app")
	log.Debug("services initialized without encryption key (limited access)")
}

// ============================================================================
// Validation Guards
// ============================================================================

// requireUnlocked validates that the app is unlocked (master key in memory)
// Use this for operations that need to encrypt/decrypt private keys
func (a *App) requireUnlocked() error {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if !a.isUnlocked {
		return fmt.Errorf("encryption key required for this operation")
	}

	if len(a.masterKey) == 0 {
		return fmt.Errorf("encryption key is empty")
	}

	return nil
}

// requireSetupOnly validates that setup is complete but does NOT require encryption key
// Use this for read-only operations like listing, viewing, deleting certificates
func (a *App) requireSetupOnly() error {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if !a.isConfigured {
		return fmt.Errorf("application not configured")
	}

	// Services must be initialized (either via ProvideEncryptionKey or SkipEncryptionKey)
	if a.waitingForEncryptionKey {
		return fmt.Errorf("encryption key decision not made")
	}

	return nil
}

// requireSetupComplete validates that setup is complete AND encryption key is provided
// Use this for operations that need both setup and encryption key
func (a *App) requireSetupComplete() error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	return a.requireUnlocked()
}

// ============================================================================
// Auto-Backup
// ============================================================================

// performAutoBackup creates an automatic database backup before a destructive operation.
// Failures are logged but never block the caller's operation.
func (a *App) performAutoBackup(operation string) {
	a.mu.RLock()
	autoBackup := a.autoBackupService
	a.mu.RUnlock()

	if autoBackup == nil {
		return
	}

	if _, err := autoBackup.CreateBackup(operation); err != nil {
		log := logger.WithComponent("app")
		log.Error("auto-backup failed, proceeding with operation",
			slog.String("operation", operation),
			logger.Err(err),
		)
		return
	}

	wailsruntime.EventsEmit(a.ctx, "backup:created", "auto", operation)
}
