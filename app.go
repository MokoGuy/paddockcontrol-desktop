package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db"
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

	logger.Info("Application starting...")
	logger.Info("Data directory: %s", dataDir)
	logger.Info("Production mode: %v", ProductionMode)

	// Initialize database
	a.db, err = db.NewDatabase(dataDir)
	if err != nil {
		logger.Error("Database initialization failed: %v", err)
		a.showFatalError("Database Error",
			fmt.Sprintf("Failed to initialize database: %v", err))
		return
	}

	logger.Info("Database initialized successfully")

	// Check if configured
	tmpConfigService := config.NewService(a.db)
	a.isConfigured, err = tmpConfigService.IsConfigured(ctx)
	if err != nil {
		logger.Error("Configuration check failed: %v", err)
		a.showFatalError("Configuration Error",
			fmt.Sprintf("Failed to check configuration: %v", err))
		return
	}

	logger.Info("Configuration status: configured=%v", a.isConfigured)

	// Initialize services without encryption key (for setup/restore to work)
	a.initializeServicesWithoutKey()
	logger.Info("Services initialized (without encryption key)")

	// Wait for encryption key from user
	a.waitingForEncryptionKey = true
	logger.Info("Waiting for encryption key...")
}

// shutdown is called when the app exits
func (a *App) shutdown(ctx context.Context) {
	logger.Info("Application shutting down...")

	if a.db != nil {
		if err := a.db.Close(); err != nil {
			logger.Error("Database close error: %v", err)
		} else {
			logger.Info("Database closed successfully")
		}
	}

	// Clear encryption key from memory
	if len(a.encryptionKey) > 0 {
		for i := range a.encryptionKey {
			a.encryptionKey[i] = 0
		}
		a.encryptionKey = nil
		logger.Info("Encryption key cleared from memory")
	}

	logger.Info("Application shutdown complete")
}

// getDataDirectory returns the platform-specific data directory
func (a *App) getDataDirectory() (string, error) {
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
	logger.Error("FATAL: %s - %s", title, message)
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

	if a.encryptionKeyProvided {
		return fmt.Errorf("encryption key already provided")
	}

	logger.Info("User skipped encryption key entry - limited functionality enabled")
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
	logger.Info("Services initialized without encryption key (limited access)")
}

// ProvideEncryptionKey stores encryption key and initializes services
// Validates the key by testing decryption on ALL stored certificates
func (a *App) ProvideEncryptionKey(key string) (*models.KeyValidationResult, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	logger.Info("Encryption key provided, validating...")

	if key == "" {
		return nil, fmt.Errorf("encryption key cannot be empty")
	}

	if len(key) < 16 {
		return nil, fmt.Errorf("encryption key must be at least 16 characters")
	}

	// If app is already configured, test decryption on ALL certificates
	if a.isConfigured && a.db != nil {
		logger.Info("Testing encryption key against ALL stored certificates...")
		certs, err := a.db.Queries().ListAllCertificates(a.ctx)
		if err != nil {
			logger.Error("Failed to list certificates for key validation: %v", err)
			return nil, fmt.Errorf("failed to validate encryption key")
		}

		var failedHostnames []string

		// Test ALL certificates with encrypted keys
		for _, cert := range certs {
			// Test active encrypted private key
			if len(cert.EncryptedPrivateKey) > 0 {
				_, err := crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, key)
				if err != nil {
					logger.Error("Encryption key validation failed for certificate: %s", cert.Hostname)
					failedHostnames = append(failedHostnames, cert.Hostname)
					continue
				}
			}

			// Test pending encrypted private key
			if len(cert.PendingEncryptedPrivateKey) > 0 {
				_, err := crypto.DecryptPrivateKey(cert.PendingEncryptedPrivateKey, key)
				if err != nil {
					logger.Error("Encryption key validation failed for pending key: %s", cert.Hostname)
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
			logger.Error("Encryption key validation failed for %d certificate(s)", len(failedHostnames))
			return &models.KeyValidationResult{
				Valid:           false,
				FailedHostnames: failedHostnames,
			}, fmt.Errorf("invalid encryption key: failed to decrypt %d certificate(s)", len(failedHostnames))
		}

		logger.Info("Encryption key validated successfully against all certificates")
	}

	// Store in memory
	a.encryptionKey = []byte(key)
	a.waitingForEncryptionKey = false
	a.encryptionKeyProvided = true

	logger.Info("Encryption key validated, initializing services...")

	// Initialize services
	a.configService = config.NewService(a.db)
	a.backupService = services.NewBackupService(a.db)
	a.certificateService = services.NewCertificateService(a.db, a.configService)
	a.setupService = services.NewSetupService(a.db, a.configService, a.backupService)

	logger.Info("All services initialized successfully")

	return &models.KeyValidationResult{Valid: true}, nil
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
	logger.Info("Saving setup configuration...")

	a.mu.RLock()
	setupService := a.setupService
	a.mu.RUnlock()

	if setupService == nil {
		return fmt.Errorf("setup service not initialized")
	}

	if err := setupService.SetupFromScratch(a.ctx, req); err != nil {
		logger.Error("Setup from scratch failed: %v", err)
		return err
	}

	a.mu.Lock()
	a.isConfigured = true
	a.mu.Unlock()

	logger.Info("Setup completed successfully")
	return nil
}

// ValidateBackupFile reads and validates backup file structure
func (a *App) ValidateBackupFile(path string) (*models.BackupValidationResult, error) {
	logger.Info("Validating backup file: %s", path)

	data, err := os.ReadFile(path)
	if err != nil {
		logger.Error("Failed to read backup file: %v", err)
		return nil, fmt.Errorf("failed to read backup file: %w", err)
	}

	var backup models.BackupData
	if err := json.Unmarshal(data, &backup); err != nil {
		logger.Error("Failed to parse backup file: %v", err)
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

	logger.Info("Backup validation: valid=%v, certs=%d, hasKeys=%v, hasKeyInBackup=%v",
		result.Valid, result.CertificateCount, result.HasEncryptedKeys, result.HasEncryptionKey)

	return result, nil
}

// ValidateEncryptionKeyForBackup tests if encryption key can decrypt backup keys
func (a *App) ValidateEncryptionKeyForBackup(backup models.BackupData, key string) error {
	logger.Info("Validating encryption key for backup restore...")

	if len(key) < 16 {
		return fmt.Errorf("encryption key must be at least 16 characters")
	}

	// Find first certificate with encrypted key
	for _, cert := range backup.Certificates {
		if len(cert.EncryptedKey) > 0 {
			// Try to decrypt
			_, err := crypto.DecryptPrivateKey(cert.EncryptedKey, key)
			if err != nil {
				logger.Error("Encryption key validation failed: %v", err)
				return fmt.Errorf("invalid encryption key: cannot decrypt certificate keys")
			}

			logger.Info("Encryption key validated successfully")
			return nil
		}

		if len(cert.PendingEncryptedKey) > 0 {
			_, err := crypto.DecryptPrivateKey(cert.PendingEncryptedKey, key)
			if err != nil {
				logger.Error("Encryption key validation failed: %v", err)
				return fmt.Errorf("invalid encryption key: cannot decrypt certificate keys")
			}

			logger.Info("Encryption key validated successfully")
			return nil
		}
	}

	// No encrypted keys found - validation passes
	logger.Info("No encrypted keys in backup, validation skipped")
	return nil
}

// RestoreFromBackup imports backup and marks setup complete
func (a *App) RestoreFromBackup(backup models.BackupData) error {
	if err := a.requireEncryptionKey(); err != nil {
		return err
	}

	logger.Info("Restoring from backup...")

	a.mu.RLock()
	setupService := a.setupService
	encryptionKey := make([]byte, len(a.encryptionKey))
	copy(encryptionKey, a.encryptionKey)
	a.mu.RUnlock()

	if setupService == nil {
		return fmt.Errorf("setup service not initialized")
	}

	if err := setupService.SetupFromBackup(a.ctx, &backup, encryptionKey); err != nil {
		logger.Error("Restore from backup failed: %v", err)
		return err
	}

	a.mu.Lock()
	a.isConfigured = true
	a.waitingForEncryptionKey = false // Key was provided during restore
	a.encryptionKeyProvided = true
	a.mu.Unlock()

	logger.Info("Restore completed successfully")
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

// ============================================================================
// Certificate Operations
// ============================================================================

// GenerateCSR generates a new Certificate Signing Request
func (a *App) GenerateCSR(req models.CSRRequest) (*models.CSRResponse, error) {
	if err := a.requireSetupComplete(); err != nil {
		return nil, err
	}

	logger.Info("Generating CSR for hostname: %s (renewal=%v)", req.Hostname, req.IsRenewal)

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
		logger.Error("CSR generation failed: %v", err)
		return nil, err
	}

	logger.Info("CSR generated successfully for: %s", req.Hostname)
	return resp, nil
}

// UploadCertificate activates a signed certificate
// Does NOT require encryption key - just adds cert PEM to existing entry
func (a *App) UploadCertificate(hostname, certPEM string) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	logger.Info("Uploading certificate for: %s", hostname)

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	if err := certificateService.UploadCertificate(a.ctx, hostname, certPEM); err != nil {
		logger.Error("Certificate upload failed: %v", err)
		return err
	}

	logger.Info("Certificate uploaded successfully for: %s", hostname)
	return nil
}

// ImportCertificate imports certificate with private key
func (a *App) ImportCertificate(req models.ImportRequest) error {
	if err := a.requireSetupComplete(); err != nil {
		return err
	}

	logger.Info("Importing certificate...")

	a.mu.RLock()
	certificateService := a.certificateService
	encryptionKey := make([]byte, len(a.encryptionKey))
	copy(encryptionKey, a.encryptionKey)
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	if err := certificateService.ImportCertificate(a.ctx, req, encryptionKey); err != nil {
		logger.Error("Certificate import failed: %v", err)
		return err
	}

	logger.Info("Certificate imported successfully")
	return nil
}

// ListCertificates returns filtered and sorted certificate list
// Does NOT require encryption key - read-only operation
func (a *App) ListCertificates(filter models.CertificateFilter) ([]*models.CertificateListItem, error) {
	if err := a.requireSetupOnly(); err != nil {
		return nil, err
	}

	logger.Debug("Listing certificates: filter=%+v", filter)

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return nil, fmt.Errorf("certificate service not initialized")
	}

	certs, err := certificateService.ListCertificates(a.ctx, filter)
	if err != nil {
		logger.Error("List certificates failed: %v", err)
		return nil, err
	}

	logger.Debug("Listed %d certificates", len(certs))
	return certs, nil
}

// GetCertificate returns detailed certificate information
// Does NOT require encryption key - read-only operation
func (a *App) GetCertificate(hostname string) (*models.Certificate, error) {
	if err := a.requireSetupOnly(); err != nil {
		return nil, err
	}

	logger.Debug("Getting certificate details for: %s", hostname)

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return nil, fmt.Errorf("certificate service not initialized")
	}

	cert, err := certificateService.GetCertificate(a.ctx, hostname)
	if err != nil {
		logger.Error("Get certificate failed: %v", err)
		return nil, err
	}

	return cert, nil
}

// DeleteCertificate deletes a certificate
// Does NOT require encryption key - deletion doesn't need decryption
func (a *App) DeleteCertificate(hostname string) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	logger.Info("Deleting certificate: %s", hostname)

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	if err := certificateService.DeleteCertificate(a.ctx, hostname); err != nil {
		logger.Error("Delete certificate failed: %v", err)
		return err
	}

	logger.Info("Certificate deleted successfully: %s", hostname)
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

	logger.Info("Downloading CSR for: %s", hostname)

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	csr, err := certificateService.GetCSRForDownload(a.ctx, hostname)
	if err != nil {
		logger.Error("Get CSR failed: %v", err)
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
		logger.Error("File dialog error: %v", err)
		return fmt.Errorf("file dialog error: %w", err)
	}

	if path == "" {
		logger.Info("User cancelled CSR save dialog")
		return nil
	}

	if err := os.WriteFile(path, []byte(csr), 0600); err != nil {
		logger.Error("Failed to write CSR file: %v", err)
		return fmt.Errorf("failed to write file: %w", err)
	}

	logger.Info("CSR saved to: %s", path)
	return nil
}

// SaveCertificateToFile prompts user to save certificate to file
// Does NOT require encryption key - certificate is not encrypted
func (a *App) SaveCertificateToFile(hostname string) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	logger.Info("Downloading certificate for: %s", hostname)

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	cert, err := certificateService.GetCertificateForDownload(a.ctx, hostname)
	if err != nil {
		logger.Error("Get certificate failed: %v", err)
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
		logger.Error("File dialog error: %v", err)
		return fmt.Errorf("file dialog error: %w", err)
	}

	if path == "" {
		logger.Info("User cancelled certificate save dialog")
		return nil
	}

	if err := os.WriteFile(path, []byte(cert), 0644); err != nil {
		logger.Error("Failed to write certificate file: %v", err)
		return fmt.Errorf("failed to write file: %w", err)
	}

	logger.Info("Certificate saved to: %s", path)
	return nil
}

// SavePrivateKeyToFile prompts user to save decrypted private key to file
func (a *App) SavePrivateKeyToFile(hostname string) error {
	if err := a.requireSetupComplete(); err != nil {
		return err
	}

	logger.Info("Downloading private key for: %s", hostname)

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
		logger.Error("Get private key failed: %v", err)
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
		logger.Error("File dialog error: %v", err)
		return fmt.Errorf("file dialog error: %w", err)
	}

	if path == "" {
		logger.Info("User cancelled private key save dialog")
		return nil
	}

	if err := os.WriteFile(path, []byte(key), 0600); err != nil {
		logger.Error("Failed to write private key file: %v", err)
		return fmt.Errorf("failed to write file: %w", err)
	}

	logger.Info("Private key saved to: %s", path)
	return nil
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

	logger.Info("Exporting backup (includeKeys=%v)...", includeKeys)

	a.mu.RLock()
	backupService := a.backupService
	a.mu.RUnlock()

	if backupService == nil {
		return fmt.Errorf("backup service not initialized")
	}

	backup, err := backupService.ExportBackup(a.ctx, includeKeys)
	if err != nil {
		logger.Error("Export backup failed: %v", err)
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
		logger.Error("File dialog error: %v", err)
		return fmt.Errorf("file dialog error: %w", err)
	}

	if path == "" {
		logger.Info("User cancelled backup export")
		return nil
	}

	data, err := json.MarshalIndent(backup, "", "  ")
	if err != nil {
		logger.Error("Failed to marshal backup: %v", err)
		return fmt.Errorf("failed to marshal backup: %w", err)
	}

	if err := os.WriteFile(path, data, 0600); err != nil {
		logger.Error("Failed to write backup file: %v", err)
		return fmt.Errorf("failed to write file: %w", err)
	}

	logger.Info("Backup exported to: %s (%d certificates)", path, len(backup.Certificates))
	return nil
}

// ============================================================================
// Utility Methods
// ============================================================================

// CopyToClipboard copies text to system clipboard
func (a *App) CopyToClipboard(text string) error {
	logger.Debug("Copying to clipboard (%d bytes)", len(text))

	if err := wailsruntime.ClipboardSetText(a.ctx, text); err != nil {
		logger.Error("Clipboard copy failed: %v", err)
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

// GetBuildInfo returns version and build information
func (a *App) GetBuildInfo() map[string]string {
	return map[string]string{
		"version":   Version,
		"buildTime": BuildTime,
		"gitCommit": GitCommit,
		"goVersion": runtime.Version(),
	}
}

// ResetDatabase deletes all data and quits the app for a fresh restart
func (a *App) ResetDatabase() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	logger.Info("Resetting database - deleting all data...")

	// Close database connection
	if a.db != nil {
		if err := a.db.Close(); err != nil {
			logger.Error("Failed to close database: %v", err)
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
			logger.Error("Failed to delete %s: %v", f, err)
		} else if err == nil {
			logger.Info("Deleted: %s", f)
		}
	}

	// Clear encryption key from memory
	if a.encryptionKey != nil {
		for i := range a.encryptionKey {
			a.encryptionKey[i] = 0
		}
		a.encryptionKey = nil
	}

	logger.Info("Database reset complete. Quitting app...")

	// Quit app - user will restart manually
	wailsruntime.Quit(a.ctx)

	return nil
}
