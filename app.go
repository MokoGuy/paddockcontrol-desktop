package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"
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
	backupService      *services.BackupService
	setupService       *services.SetupService
	configService      *config.Service

	// Runtime state
	encryptionKey           []byte
	waitingForEncryptionKey bool
	encryptionKeyProvided   bool // true only if key was actually provided (not skipped)
	isConfigured            bool
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

	// Initialize services without encryption key (for setup/restore to work)
	a.initializeServicesWithoutKey()
	log.Info("services initialized without encryption key")

	// Auto-skip encryption key at startup (limited mode by default)
	// Users can provide key anytime via Settings
	a.waitingForEncryptionKey = false
	a.encryptionKeyProvided = false
	log.Info("starting in limited mode - encryption key can be provided via Settings")
}

// domReady is called when the frontend DOM is ready
func (a *App) domReady(ctx context.Context) {
	log := logger.WithComponent("app")
	log.Info("DOM ready, emitting wails:ready event")
	wailsruntime.EventsEmit(ctx, "wails:ready")
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

	// Clear encryption key from memory
	if len(a.encryptionKey) > 0 {
		for i := range a.encryptionKey {
			a.encryptionKey[i] = 0
		}
		a.encryptionKey = nil
		log.Info("encryption key cleared from memory")
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

// requireEncryptionKey validates that encryption key is provided
// Use this for operations that need to encrypt/decrypt private keys
func (a *App) requireEncryptionKey() error {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if !a.encryptionKeyProvided {
		return fmt.Errorf("encryption key required for this operation")
	}

	if len(a.encryptionKey) == 0 {
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

	return a.requireEncryptionKey()
}

// ============================================================================
// Encryption Key Management
// ============================================================================

// IsWaitingForEncryptionKey returns true if app is waiting for encryption key
func (a *App) IsWaitingForEncryptionKey() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.waitingForEncryptionKey
}

// IsEncryptionKeyProvided returns true if encryption key was actually provided (not skipped)
func (a *App) IsEncryptionKeyProvided() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.encryptionKeyProvided
}

// SkipEncryptionKey allows user to skip encryption key entry and proceed with limited functionality
func (a *App) SkipEncryptionKey() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	log := logger.WithComponent("app")

	if a.encryptionKeyProvided {
		return fmt.Errorf("encryption key already provided")
	}

	log.Info("user skipped encryption key entry - limited functionality enabled")
	a.waitingForEncryptionKey = false
	a.encryptionKeyProvided = false

	// Initialize services without encryption key for read-only operations
	a.initializeServicesWithoutKey()

	return nil
}

// initializeServicesWithoutKey initializes services for read-only access
func (a *App) initializeServicesWithoutKey() {
	a.configService = config.NewService(a.db)
	a.backupService = services.NewBackupService(a.db)
	a.certificateService = services.NewCertificateService(a.db, a.configService)
	a.setupService = services.NewSetupService(a.db, a.configService, a.backupService)

	log := logger.WithComponent("app")
	log.Debug("services initialized without encryption key (limited access)")
}

// ProvideEncryptionKey stores encryption key and initializes services
// Validates the key by testing decryption on ALL stored certificates
func (a *App) ProvideEncryptionKey(key string) (*models.KeyValidationResult, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	_, log := logger.WithOperation(a.ctx, "provide_encryption_key")
	log.Info("encryption key provided, validating")

	if key == "" {
		return nil, fmt.Errorf("encryption key cannot be empty")
	}

	if len(key) < 16 {
		return nil, fmt.Errorf("encryption key must be at least 16 characters")
	}

	// If app is already configured, test decryption on ALL certificates
	if a.isConfigured && a.db != nil {
		log.Info("testing encryption key against all stored certificates")
		certs, err := a.db.Queries().ListAllCertificates(a.ctx)
		if err != nil {
			log.Error("failed to list certificates for key validation", logger.Err(err))
			return nil, fmt.Errorf("failed to validate encryption key")
		}

		var failedHostnames []string

		// Test ALL certificates with encrypted keys
		for _, cert := range certs {
			certLog := logger.WithHostname(log, cert.Hostname)

			// Test active encrypted private key
			if len(cert.EncryptedPrivateKey) > 0 {
				_, err := crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, key)
				if err != nil {
					certLog.Error("encryption key validation failed for certificate")
					failedHostnames = append(failedHostnames, cert.Hostname)
					continue
				}
			}

			// Test pending encrypted private key
			if len(cert.PendingEncryptedPrivateKey) > 0 {
				_, err := crypto.DecryptPrivateKey(cert.PendingEncryptedPrivateKey, key)
				if err != nil {
					certLog.Error("encryption key validation failed for pending key")
					// Only add if not already in the list
					found := false
					for _, h := range failedHostnames {
						if h == cert.Hostname {
							found = true
							break
						}
					}
					if !found {
						failedHostnames = append(failedHostnames, cert.Hostname)
					}
				}
			}
		}

		// If any certificates failed, return error with details
		if len(failedHostnames) > 0 {
			log.Error("encryption key validation failed",
				slog.Int("failed_count", len(failedHostnames)),
				slog.Any("failed_hostnames", failedHostnames),
			)
			return &models.KeyValidationResult{
				Valid:           false,
				FailedHostnames: failedHostnames,
			}, fmt.Errorf("invalid encryption key: failed to decrypt %d certificate(s)", len(failedHostnames))
		}

		log.Info("encryption key validated successfully against all certificates")
	}

	// Store in memory
	a.encryptionKey = []byte(key)
	a.waitingForEncryptionKey = false
	a.encryptionKeyProvided = true

	log.Info("encryption key validated, initializing services")

	// Initialize services
	a.configService = config.NewService(a.db)
	a.backupService = services.NewBackupService(a.db)
	a.certificateService = services.NewCertificateService(a.db, a.configService)
	a.setupService = services.NewSetupService(a.db, a.configService, a.backupService)

	log.Info("all services initialized successfully")

	return &models.KeyValidationResult{Valid: true}, nil
}

// ClearEncryptionKey clears the provided encryption key and returns to read-only mode
func (a *App) ClearEncryptionKey() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	log := logger.WithComponent("app")

	if !a.encryptionKeyProvided {
		return fmt.Errorf("no encryption key to clear")
	}

	log.Info("clearing encryption key - returning to read-only mode")

	// Zero out the encryption key for security
	for i := range a.encryptionKey {
		a.encryptionKey[i] = 0
	}
	a.encryptionKey = nil
	a.encryptionKeyProvided = false
	// Keep waitingForEncryptionKey = false (user can provide again from Settings)

	return nil
}

// ChangeEncryptionKey changes the encryption key by re-encrypting all certificates atomically
// Requires the current encryption key to be already provided
func (a *App) ChangeEncryptionKey(newKey string) error {
	// Check current key is provided (without holding the lock for the entire operation)
	if err := a.requireEncryptionKey(); err != nil {
		return fmt.Errorf("current encryption key required: %w", err)
	}

	// Validate new key
	if len(newKey) < 16 {
		return fmt.Errorf("new encryption key must be at least 16 characters")
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	_, log := logger.WithOperation(a.ctx, "change_encryption_key")
	log.Info("changing encryption key - starting atomic re-encryption")

	// Get all certificates
	certs, err := a.db.Queries().ListAllCertificates(a.ctx)
	if err != nil {
		log.Error("failed to list certificates", logger.Err(err))
		return fmt.Errorf("failed to list certificates: %w", err)
	}

	// Pre-compute all re-encrypted keys (decrypt with old, encrypt with new)
	type reEncryptedCert struct {
		Hostname                      string
		NewEncryptedPrivateKey        []byte
		NewPendingEncryptedPrivateKey []byte
	}
	var reEncrypted []reEncryptedCert

	oldKey := string(a.encryptionKey)

	for _, cert := range certs {
		certLog := logger.WithHostname(log, cert.Hostname)
		rec := reEncryptedCert{Hostname: cert.Hostname}

		// Re-encrypt active private key if present
		if len(cert.EncryptedPrivateKey) > 0 {
			plaintext, err := crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, oldKey)
			if err != nil {
				certLog.Error("failed to decrypt key", logger.Err(err))
				return fmt.Errorf("failed to decrypt key for %s: %w", cert.Hostname, err)
			}
			newEncrypted, err := crypto.EncryptPrivateKey(plaintext, newKey)
			if err != nil {
				certLog.Error("failed to re-encrypt key", logger.Err(err))
				return fmt.Errorf("failed to re-encrypt key for %s: %w", cert.Hostname, err)
			}
			rec.NewEncryptedPrivateKey = newEncrypted
		}

		// Re-encrypt pending private key if present
		if len(cert.PendingEncryptedPrivateKey) > 0 {
			plaintext, err := crypto.DecryptPrivateKey(cert.PendingEncryptedPrivateKey, oldKey)
			if err != nil {
				certLog.Error("failed to decrypt pending key", logger.Err(err))
				return fmt.Errorf("failed to decrypt pending key for %s: %w", cert.Hostname, err)
			}
			newEncrypted, err := crypto.EncryptPrivateKey(plaintext, newKey)
			if err != nil {
				certLog.Error("failed to re-encrypt pending key", logger.Err(err))
				return fmt.Errorf("failed to re-encrypt pending key for %s: %w", cert.Hostname, err)
			}
			rec.NewPendingEncryptedPrivateKey = newEncrypted
		}

		reEncrypted = append(reEncrypted, rec)
	}

	// Atomic transaction: update all certificates
	tx, err := a.db.GetDB().BeginTx(a.ctx, nil)
	if err != nil {
		log.Error("failed to begin transaction", logger.Err(err))
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback() // Will be no-op if commit succeeds

	qtx := a.db.Queries().WithTx(tx)

	for _, rec := range reEncrypted {
		err := qtx.UpdateEncryptedKeys(a.ctx, sqlc.UpdateEncryptedKeysParams{
			EncryptedPrivateKey:        rec.NewEncryptedPrivateKey,
			PendingEncryptedPrivateKey: rec.NewPendingEncryptedPrivateKey,
			Hostname:                   rec.Hostname,
		})
		if err != nil {
			log.Error("failed to update keys",
				slog.String("hostname", rec.Hostname),
				logger.Err(err),
			)
			return fmt.Errorf("failed to update keys for %s: %w", rec.Hostname, err)
		}
	}

	if err := tx.Commit(); err != nil {
		log.Error("failed to commit transaction", logger.Err(err))
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Update in-memory key - zero out old key for security
	for i := range a.encryptionKey {
		a.encryptionKey[i] = 0
	}
	a.encryptionKey = []byte(newKey)

	log.Info("encryption key changed successfully", slog.Int("re_encrypted_count", len(reEncrypted)))
	return nil
}

// ============================================================================
// Setup Operations
// ============================================================================

// IsSetupComplete returns true if initial setup is complete
func (a *App) IsSetupComplete() (bool, error) {
	a.mu.RLock()
	setupService := a.setupService
	isConfigured := a.isConfigured
	a.mu.RUnlock()

	// During startup, before encryption key provided
	if setupService == nil {
		return isConfigured, nil
	}

	return setupService.IsConfigured(a.ctx)
}

// SaveSetup creates new configuration from scratch
func (a *App) SaveSetup(req models.SetupRequest) error {
	// No encryption key required - just saving CA configuration
	_, log := logger.WithOperation(a.ctx, "save_setup")
	log.Info("saving setup configuration",
		slog.String("owner_email", req.OwnerEmail),
		slog.String("ca_name", req.CAName),
	)

	a.mu.RLock()
	setupService := a.setupService
	a.mu.RUnlock()

	if setupService == nil {
		return fmt.Errorf("setup service not initialized")
	}

	if err := setupService.SetupFromScratch(a.ctx, req); err != nil {
		log.Error("setup from scratch failed", logger.Err(err))
		return err
	}

	a.mu.Lock()
	a.isConfigured = true
	a.mu.Unlock()

	log.Info("setup completed successfully")
	return nil
}

// ValidateBackupFile reads and validates backup file structure
func (a *App) ValidateBackupFile(path string) (*models.BackupValidationResult, error) {
	log := logger.WithComponent("app")
	log.Info("validating backup file", slog.String("path", path))

	data, err := os.ReadFile(path)
	if err != nil {
		log.Error("failed to read backup file", logger.Err(err))
		return nil, fmt.Errorf("failed to read backup file: %w", err)
	}

	var backup models.BackupData
	if err := json.Unmarshal(data, &backup); err != nil {
		log.Error("failed to parse backup file", logger.Err(err))
		return nil, fmt.Errorf("invalid backup file format: %w", err)
	}

	hasEncryptedKeys := false
	for _, cert := range backup.Certificates {
		if len(cert.EncryptedKey) > 0 || len(cert.PendingEncryptedKey) > 0 {
			hasEncryptedKeys = true
			break
		}
	}

	result := &models.BackupValidationResult{
		Valid:            true,
		Version:          backup.Version,
		CertificateCount: len(backup.Certificates),
		HasEncryptedKeys: hasEncryptedKeys,
		HasEncryptionKey: backup.EncryptionKey != "",
		EncryptionKey:    backup.EncryptionKey,
		ExportedAt:       backup.ExportedAt,
	}

	log.Info("backup validation complete",
		slog.Bool("valid", result.Valid),
		slog.Int("certificate_count", result.CertificateCount),
		slog.Bool("has_encrypted_keys", result.HasEncryptedKeys),
		slog.Bool("has_key_in_backup", result.HasEncryptionKey),
	)

	return result, nil
}

// ValidateEncryptionKeyForBackup tests if encryption key can decrypt backup keys
func (a *App) ValidateEncryptionKeyForBackup(backup models.BackupData, key string) error {
	log := logger.WithComponent("app")
	log.Info("validating encryption key for backup restore")

	if len(key) < 16 {
		return fmt.Errorf("encryption key must be at least 16 characters")
	}

	// Find first certificate with encrypted key
	for _, cert := range backup.Certificates {
		if len(cert.EncryptedKey) > 0 {
			// Try to decrypt
			_, err := crypto.DecryptPrivateKey(cert.EncryptedKey, key)
			if err != nil {
				log.Error("encryption key validation failed", logger.Err(err))
				return fmt.Errorf("invalid encryption key: cannot decrypt certificate keys")
			}

			log.Info("encryption key validated successfully")
			return nil
		}

		if len(cert.PendingEncryptedKey) > 0 {
			_, err := crypto.DecryptPrivateKey(cert.PendingEncryptedKey, key)
			if err != nil {
				log.Error("encryption key validation failed", logger.Err(err))
				return fmt.Errorf("invalid encryption key: cannot decrypt certificate keys")
			}

			log.Info("encryption key validated successfully")
			return nil
		}
	}

	// No encrypted keys found - validation passes
	log.Info("no encrypted keys in backup, validation skipped")
	return nil
}

// RestoreFromBackup imports backup and marks setup complete
func (a *App) RestoreFromBackup(backup models.BackupData) error {
	if err := a.requireEncryptionKey(); err != nil {
		return err
	}

	_, log := logger.WithOperation(a.ctx, "restore_backup")
	log.Info("restoring from backup",
		slog.String("version", backup.Version),
		slog.Int("certificates", len(backup.Certificates)),
	)

	a.mu.RLock()
	setupService := a.setupService
	encryptionKey := make([]byte, len(a.encryptionKey))
	copy(encryptionKey, a.encryptionKey)
	a.mu.RUnlock()

	if setupService == nil {
		return fmt.Errorf("setup service not initialized")
	}

	if err := setupService.SetupFromBackup(a.ctx, &backup, encryptionKey); err != nil {
		log.Error("restore from backup failed", logger.Err(err))
		return err
	}

	a.mu.Lock()
	a.isConfigured = true
	a.waitingForEncryptionKey = false // Key was provided during restore
	a.encryptionKeyProvided = true
	a.mu.Unlock()

	log.Info("restore completed successfully")
	return nil
}

// GetSetupDefaults returns default values for setup form
func (a *App) GetSetupDefaults() *models.SetupDefaults {
	a.mu.RLock()
	setupService := a.setupService
	a.mu.RUnlock()

	if setupService == nil {
		return &models.SetupDefaults{
			ValidityPeriodDays: 365,
			DefaultKeySize:     4096,
			DefaultCountry:     "FR",
		}
	}
	return setupService.GetSetupDefaults()
}

// GetConfig returns the current configuration
func (a *App) GetConfig() (*models.Config, error) {
	log := logger.WithComponent("app")
	log.Debug("getting configuration")

	a.mu.RLock()
	configService := a.configService
	a.mu.RUnlock()

	if configService == nil {
		return nil, fmt.Errorf("config service not initialized")
	}

	cfg, err := configService.GetConfig(a.ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}

	// Convert sqlc.Config to models.Config
	return &models.Config{
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
	}, nil
}

// UpdateConfig updates the application configuration
func (a *App) UpdateConfig(req models.UpdateConfigRequest) (*models.Config, error) {
	_, log := logger.WithOperation(a.ctx, "update_config")
	log.Info("updating configuration",
		slog.String("owner_email", req.OwnerEmail),
		slog.String("ca_name", req.CAName),
	)

	// Validate request
	if err := config.ValidateConfigUpdate(&req); err != nil {
		log.Error("config validation failed", logger.Err(err))
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	a.mu.RLock()
	configService := a.configService
	a.mu.RUnlock()

	if configService == nil {
		return nil, fmt.Errorf("config service not initialized")
	}

	// Update configuration
	updatedConfig, err := configService.UpdateConfig(a.ctx, &req)
	if err != nil {
		log.Error("failed to update config", logger.Err(err))
		return nil, fmt.Errorf("failed to update config: %w", err)
	}

	log.Info("configuration updated successfully")
	return updatedConfig, nil
}

// ============================================================================
// Certificate Operations
// ============================================================================

// GenerateCSR generates a new Certificate Signing Request
func (a *App) GenerateCSR(req models.CSRRequest) (*models.CSRResponse, error) {
	if err := a.requireSetupComplete(); err != nil {
		return nil, err
	}

	_, log := logger.WithOperation(a.ctx, "generate_csr")
	log = logger.WithHostname(log, req.Hostname)
	log.Info("generating CSR",
		slog.Bool("is_renewal", req.IsRenewal),
		slog.Int("key_size", req.KeySize),
		slog.Int("san_count", len(req.SANs)),
	)

	a.mu.RLock()
	certificateService := a.certificateService
	encryptionKey := make([]byte, len(a.encryptionKey))
	copy(encryptionKey, a.encryptionKey)
	a.mu.RUnlock()

	if certificateService == nil {
		return nil, fmt.Errorf("certificate service not initialized")
	}

	resp, err := certificateService.GenerateCSR(a.ctx, req, encryptionKey)
	if err != nil {
		log.Error("CSR generation failed", logger.Err(err))
		return nil, err
	}

	log.Info("CSR generated successfully")
	return resp, nil
}

// UploadCertificate activates a signed certificate
// Does NOT require encryption key - just adds cert PEM to existing entry
func (a *App) UploadCertificate(hostname, certPEM string) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	_, log := logger.WithOperation(a.ctx, "upload_certificate")
	log = logger.WithHostname(log, hostname)
	log.Info("uploading certificate")

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	if err := certificateService.UploadCertificate(a.ctx, hostname, certPEM); err != nil {
		log.Error("certificate upload failed", logger.Err(err))
		return err
	}

	log.Info("certificate uploaded successfully")
	return nil
}

// ImportCertificate imports certificate with private key
func (a *App) ImportCertificate(req models.ImportRequest) error {
	if err := a.requireSetupComplete(); err != nil {
		return err
	}

	_, log := logger.WithOperation(a.ctx, "import_certificate")
	log.Info("importing certificate")

	a.mu.RLock()
	certificateService := a.certificateService
	encryptionKey := make([]byte, len(a.encryptionKey))
	copy(encryptionKey, a.encryptionKey)
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	if err := certificateService.ImportCertificate(a.ctx, req, encryptionKey); err != nil {
		log.Error("certificate import failed", logger.Err(err))
		return err
	}

	log.Info("certificate imported successfully")
	return nil
}

// ListCertificates returns filtered and sorted certificate list
// Does NOT require encryption key - read-only operation
func (a *App) ListCertificates(filter models.CertificateFilter) ([]*models.CertificateListItem, error) {
	if err := a.requireSetupOnly(); err != nil {
		return nil, err
	}

	log := logger.WithComponent("app")
	log.Debug("listing certificates", slog.Any("filter", filter))

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return nil, fmt.Errorf("certificate service not initialized")
	}

	certs, err := certificateService.ListCertificates(a.ctx, filter)
	if err != nil {
		log.Error("list certificates failed", logger.Err(err))
		return nil, err
	}

	log.Debug("listed certificates", slog.Int("count", len(certs)))
	return certs, nil
}

// GetCertificate returns detailed certificate information
// Does NOT require encryption key - read-only operation
func (a *App) GetCertificate(hostname string) (*models.Certificate, error) {
	if err := a.requireSetupOnly(); err != nil {
		return nil, err
	}

	log := logger.WithComponent("app")
	log.Debug("getting certificate details", slog.String("hostname", hostname))

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return nil, fmt.Errorf("certificate service not initialized")
	}

	cert, err := certificateService.GetCertificate(a.ctx, hostname)
	if err != nil {
		log.Error("get certificate failed", slog.String("hostname", hostname), logger.Err(err))
		return nil, err
	}

	return cert, nil
}

// GetCertificateChain returns the certificate chain for a hostname
// Fetches chain via AIA (Authority Information Access) from the leaf certificate
// Does NOT require encryption key - read-only operation
func (a *App) GetCertificateChain(hostname string) ([]models.ChainCertificateInfo, error) {
	if err := a.requireSetupOnly(); err != nil {
		return nil, err
	}

	log := logger.WithComponent("app")
	log.Debug("getting certificate chain", slog.String("hostname", hostname))

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return nil, fmt.Errorf("certificate service not initialized")
	}

	chain, err := certificateService.GetCertificateChain(a.ctx, hostname)
	if err != nil {
		log.Error("get certificate chain failed", slog.String("hostname", hostname), logger.Err(err))
		return nil, err
	}

	log.Debug("certificate chain retrieved", slog.String("hostname", hostname), slog.Int("count", len(chain)))
	return chain, nil
}

// DeleteCertificate deletes a certificate
// Does NOT require encryption key - deletion doesn't need decryption
func (a *App) DeleteCertificate(hostname string) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	_, log := logger.WithOperation(a.ctx, "delete_certificate")
	log = logger.WithHostname(log, hostname)
	log.Info("deleting certificate")

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	if err := certificateService.DeleteCertificate(a.ctx, hostname); err != nil {
		log.Error("delete certificate failed", logger.Err(err))
		return err
	}

	log.Info("certificate deleted successfully")
	return nil
}

// SetCertificateReadOnly sets the read-only status of a certificate
func (a *App) SetCertificateReadOnly(hostname string, readOnly bool) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	log := logger.WithComponent("app")
	log.Info("setting certificate read-only status",
		slog.String("hostname", hostname),
		slog.Bool("read_only", readOnly),
	)

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	if err := certificateService.SetCertificateReadOnly(a.ctx, hostname, readOnly); err != nil {
		log.Error("set certificate read-only failed",
			slog.String("hostname", hostname),
			logger.Err(err),
		)
		return err
	}

	log.Info("certificate read-only status updated",
		slog.String("hostname", hostname),
		slog.Bool("read_only", readOnly),
	)
	return nil
}

// ============================================================================
// Download Operations (with File Dialogs)
// ============================================================================

// SaveCSRToFile prompts user to save CSR to file
// Does NOT require encryption key - CSR is not encrypted
func (a *App) SaveCSRToFile(hostname string) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	log := logger.WithComponent("app")
	log.Info("downloading CSR", slog.String("hostname", hostname))

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	csr, err := certificateService.GetCSRForDownload(a.ctx, hostname)
	if err != nil {
		log.Error("get CSR failed", slog.String("hostname", hostname), logger.Err(err))
		return err
	}

	path, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		DefaultFilename: hostname + ".csr",
		Title:           "Save Certificate Signing Request",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "CSR Files (*.csr)", Pattern: "*.csr"},
			{DisplayName: "PEM Files (*.pem)", Pattern: "*.pem"},
			{DisplayName: "All Files (*.*)", Pattern: "*.*"},
		},
	})

	if err != nil {
		log.Error("file dialog error", logger.Err(err))
		return fmt.Errorf("file dialog error: %w", err)
	}

	if path == "" {
		log.Info("user cancelled CSR save dialog")
		return nil
	}

	if err := os.WriteFile(path, []byte(csr), 0600); err != nil {
		log.Error("failed to write CSR file", slog.String("path", path), logger.Err(err))
		return fmt.Errorf("failed to write file: %w", err)
	}

	log.Info("CSR saved", slog.String("path", path))
	return nil
}

// SaveCertificateToFile prompts user to save certificate to file
// Does NOT require encryption key - certificate is not encrypted
func (a *App) SaveCertificateToFile(hostname string) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	log := logger.WithComponent("app")
	log.Info("downloading certificate", slog.String("hostname", hostname))

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	cert, err := certificateService.GetCertificateForDownload(a.ctx, hostname)
	if err != nil {
		log.Error("get certificate failed", slog.String("hostname", hostname), logger.Err(err))
		return err
	}

	path, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		DefaultFilename: hostname + ".crt",
		Title:           "Save Certificate",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "Certificate Files (*.crt)", Pattern: "*.crt"},
			{DisplayName: "PEM Files (*.pem)", Pattern: "*.pem"},
			{DisplayName: "All Files (*.*)", Pattern: "*.*"},
		},
	})

	if err != nil {
		log.Error("file dialog error", logger.Err(err))
		return fmt.Errorf("file dialog error: %w", err)
	}

	if path == "" {
		log.Info("user cancelled certificate save dialog")
		return nil
	}

	if err := os.WriteFile(path, []byte(cert), 0644); err != nil {
		log.Error("failed to write certificate file", slog.String("path", path), logger.Err(err))
		return fmt.Errorf("failed to write file: %w", err)
	}

	log.Info("certificate saved", slog.String("path", path))
	return nil
}

// SaveChainToFile prompts user to save certificate chain to file
// Chain includes: leaf certificate + intermediate CAs + root CA
// Does NOT require encryption key - certificates are not encrypted
func (a *App) SaveChainToFile(hostname string) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	log := logger.WithComponent("app")
	log.Info("downloading certificate chain", slog.String("hostname", hostname))

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	chainPEM, err := certificateService.GetChainPEMForDownload(a.ctx, hostname)
	if err != nil {
		log.Error("get chain failed", slog.String("hostname", hostname), logger.Err(err))
		return err
	}

	path, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		DefaultFilename: hostname + "-chain.crt",
		Title:           "Save Certificate Chain",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "Certificate Files (*.crt)", Pattern: "*.crt"},
			{DisplayName: "PEM Files (*.pem)", Pattern: "*.pem"},
			{DisplayName: "All Files (*.*)", Pattern: "*.*"},
		},
	})

	if err != nil {
		log.Error("file dialog error", logger.Err(err))
		return fmt.Errorf("file dialog error: %w", err)
	}

	if path == "" {
		log.Info("user cancelled chain save dialog")
		return nil
	}

	if err := os.WriteFile(path, []byte(chainPEM), 0644); err != nil {
		log.Error("failed to write chain file", slog.String("path", path), logger.Err(err))
		return fmt.Errorf("failed to write file: %w", err)
	}

	log.Info("chain saved", slog.String("path", path))
	return nil
}

// SavePrivateKeyToFile prompts user to save decrypted private key to file
func (a *App) SavePrivateKeyToFile(hostname string) error {
	if err := a.requireSetupComplete(); err != nil {
		return err
	}

	log := logger.WithComponent("app")
	log.Info("downloading private key", slog.String("hostname", hostname))

	a.mu.RLock()
	certificateService := a.certificateService
	encryptionKey := make([]byte, len(a.encryptionKey))
	copy(encryptionKey, a.encryptionKey)
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	key, err := certificateService.GetPrivateKeyForDownload(a.ctx, hostname, encryptionKey)
	if err != nil {
		log.Error("get private key failed", slog.String("hostname", hostname), logger.Err(err))
		return err
	}

	path, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		DefaultFilename: hostname + ".key",
		Title:           "Save Private Key",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "Key Files (*.key)", Pattern: "*.key"},
			{DisplayName: "PEM Files (*.pem)", Pattern: "*.pem"},
			{DisplayName: "All Files (*.*)", Pattern: "*.*"},
		},
	})

	if err != nil {
		log.Error("file dialog error", logger.Err(err))
		return fmt.Errorf("file dialog error: %w", err)
	}

	if path == "" {
		log.Info("user cancelled private key save dialog")
		return nil
	}

	if err := os.WriteFile(path, []byte(key), 0600); err != nil {
		log.Error("failed to write private key file", slog.String("path", path), logger.Err(err))
		return fmt.Errorf("failed to write file: %w", err)
	}

	log.Info("private key saved", slog.String("path", path))
	return nil
}

// GetPrivateKeyPEM returns the decrypted private key PEM for display in UI
func (a *App) GetPrivateKeyPEM(hostname string) (string, error) {
	if err := a.requireSetupComplete(); err != nil {
		return "", err
	}

	log := logger.WithComponent("app")
	log.Debug("getting private key PEM", slog.String("hostname", hostname))

	a.mu.RLock()
	certificateService := a.certificateService
	encryptionKey := make([]byte, len(a.encryptionKey))
	copy(encryptionKey, a.encryptionKey)
	a.mu.RUnlock()

	if certificateService == nil {
		return "", fmt.Errorf("certificate service not initialized")
	}

	privateKeyPEM, err := certificateService.GetPrivateKeyForDownload(a.ctx, hostname, encryptionKey)
	if err != nil {
		log.Error("get private key PEM failed", slog.String("hostname", hostname), logger.Err(err))
		return "", err
	}

	return privateKeyPEM, nil
}

// ============================================================================
// Backup Operations
// ============================================================================

// ExportBackup prompts user to save backup file
// Requires encryption key only if includeKeys is true
func (a *App) ExportBackup(includeKeys bool) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	// If including keys, require encryption key
	if includeKeys {
		if err := a.requireEncryptionKey(); err != nil {
			return fmt.Errorf("encryption key required to export backup with private keys")
		}
	}

	_, log := logger.WithOperation(a.ctx, "export_backup")
	log.Info("exporting backup", slog.Bool("include_keys", includeKeys))

	a.mu.RLock()
	backupService := a.backupService
	a.mu.RUnlock()

	if backupService == nil {
		return fmt.Errorf("backup service not initialized")
	}

	backup, err := backupService.ExportBackup(a.ctx, includeKeys)
	if err != nil {
		log.Error("export backup failed", logger.Err(err))
		return err
	}

	path, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		DefaultFilename: fmt.Sprintf("paddockcontrol-backup-%s.json",
			time.Now().Format("20060102-150405")),
		Title: "Export Backup",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
			{DisplayName: "All Files (*.*)", Pattern: "*.*"},
		},
	})

	if err != nil {
		log.Error("file dialog error", logger.Err(err))
		return fmt.Errorf("file dialog error: %w", err)
	}

	if path == "" {
		log.Info("user cancelled backup export")
		return nil
	}

	data, err := json.MarshalIndent(backup, "", "  ")
	if err != nil {
		log.Error("failed to marshal backup", logger.Err(err))
		return fmt.Errorf("failed to marshal backup: %w", err)
	}

	if err := os.WriteFile(path, data, 0600); err != nil {
		log.Error("failed to write backup file", slog.String("path", path), logger.Err(err))
		return fmt.Errorf("failed to write file: %w", err)
	}

	log.Info("backup exported", slog.String("path", path), slog.Int("certificates", len(backup.Certificates)))
	return nil
}

// ============================================================================
// Log Export Operations
// ============================================================================

// GetLogInfo returns information about log files for display in UI
func (a *App) GetLogInfo() (*logger.LogFileInfo, error) {
	return logger.GetLogFileInfo()
}

// ExportLogs creates a ZIP archive of all log files and prompts user to save
func (a *App) ExportLogs() error {
	log := logger.WithComponent("app")
	log.Info("exporting application logs")

	// Generate temp file path
	tempFile := filepath.Join(os.TempDir(), fmt.Sprintf(
		"paddockcontrol-logs-%s.zip",
		time.Now().Format("20060102-150405"),
	))

	// Export logs to temp file
	if err := logger.ExportLogs(tempFile); err != nil {
		log.Error("failed to create log archive", logger.Err(err))
		return fmt.Errorf("failed to create log archive: %w", err)
	}
	defer os.Remove(tempFile) // Clean up temp file

	// Show save dialog
	path, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		DefaultFilename: filepath.Base(tempFile),
		Title:           "Export Application Logs",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "ZIP Archives (*.zip)", Pattern: "*.zip"},
		},
	})

	if err != nil {
		log.Error("file dialog error", logger.Err(err))
		return fmt.Errorf("file dialog error: %w", err)
	}

	if path == "" {
		log.Info("user cancelled log export")
		return nil
	}

	// Copy temp file to selected location
	if err := copyFile(tempFile, path); err != nil {
		log.Error("failed to save log archive", slog.String("path", path), logger.Err(err))
		return fmt.Errorf("failed to save log archive: %w", err)
	}

	log.Info("logs exported successfully", slog.String("path", path))
	return nil
}

// copyFile copies a file from src to dst
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}

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

// OpenBugReport opens the GitLab issues page for bug reporting
func (a *App) OpenBugReport() error {
	return a.OpenURL("https://gitlab-erp-pas.dedalus.lan/erp-pas/paddockcontrol/paddockcontrol-desktop/-/issues")
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
