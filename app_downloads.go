package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"paddockcontrol-desktop/internal/logger"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

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
// Backup Export Operations
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
