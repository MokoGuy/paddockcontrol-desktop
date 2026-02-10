package main

import (
	"fmt"
	"log/slog"

	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"
)

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
// Requires encryption key to validate cert matches pending private key
func (a *App) UploadCertificate(hostname, certPEM string) error {
	if err := a.requireSetupComplete(); err != nil {
		return err
	}

	_, log := logger.WithOperation(a.ctx, "upload_certificate")
	log = logger.WithHostname(log, hostname)
	log.Info("uploading certificate")

	a.performAutoBackup("upload_certificate")

	a.mu.RLock()
	certificateService := a.certificateService
	encryptionKey := make([]byte, len(a.encryptionKey))
	copy(encryptionKey, a.encryptionKey)
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	if err := certificateService.UploadCertificate(a.ctx, hostname, certPEM, encryptionKey); err != nil {
		log.Error("certificate upload failed", logger.Err(err))
		return err
	}

	log.Info("certificate uploaded successfully")
	return nil
}

// PreviewCertificateUpload validates a signed certificate and returns its metadata
// Requires encryption key to validate cert matches pending private key
func (a *App) PreviewCertificateUpload(hostname, certPEM string) (*models.CertificateUploadPreview, error) {
	if err := a.requireSetupComplete(); err != nil {
		return nil, err
	}

	_, log := logger.WithOperation(a.ctx, "preview_certificate_upload")
	log = logger.WithHostname(log, hostname)
	log.Info("previewing certificate upload")

	a.mu.RLock()
	certificateService := a.certificateService
	encryptionKey := make([]byte, len(a.encryptionKey))
	copy(encryptionKey, a.encryptionKey)
	a.mu.RUnlock()

	if certificateService == nil {
		return nil, fmt.Errorf("certificate service not initialized")
	}

	preview, err := certificateService.PreviewCertificateUpload(a.ctx, hostname, certPEM, encryptionKey)
	if err != nil {
		log.Error("certificate upload preview failed", logger.Err(err))
		return nil, err
	}

	log.Info("certificate upload preview generated")
	return preview, nil
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

	a.performAutoBackup("delete_certificate")

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

// ClearPendingCSR removes the pending CSR data from a certificate while keeping the active certificate
// Does NOT require encryption key - no decryption needed
func (a *App) ClearPendingCSR(hostname string) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	_, log := logger.WithOperation(a.ctx, "clear_pending_csr")
	log = logger.WithHostname(log, hostname)
	log.Info("clearing pending CSR")

	a.performAutoBackup("clear_pending_csr")

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	if err := certificateService.ClearPendingCSR(a.ctx, hostname); err != nil {
		log.Error("clear pending CSR failed", logger.Err(err))
		return err
	}

	log.Info("pending CSR cleared successfully")
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

// UpdateCertificateNote updates the description/note for a certificate
func (a *App) UpdateCertificateNote(hostname string, note string) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	log := logger.WithComponent("app")
	log.Info("updating certificate note", slog.String("hostname", hostname))

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	if err := certificateService.UpdateCertificateNote(a.ctx, hostname, note); err != nil {
		log.Error("update certificate note failed",
			slog.String("hostname", hostname),
			logger.Err(err),
		)
		return err
	}

	log.Info("certificate note updated", slog.String("hostname", hostname))
	return nil
}

// UpdatePendingNote updates the pending description/note for a certificate
func (a *App) UpdatePendingNote(hostname string, note string) error {
	if err := a.requireSetupOnly(); err != nil {
		return err
	}

	log := logger.WithComponent("app")
	log.Info("updating pending note", slog.String("hostname", hostname))

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return fmt.Errorf("certificate service not initialized")
	}

	if err := certificateService.UpdatePendingNote(a.ctx, hostname, note); err != nil {
		log.Error("update pending note failed",
			slog.String("hostname", hostname),
			logger.Err(err),
		)
		return err
	}

	log.Info("pending note updated", slog.String("hostname", hostname))
	return nil
}

// GetCertificateHistory returns the activity history for a certificate
func (a *App) GetCertificateHistory(hostname string, limit int) ([]models.HistoryEntry, error) {
	if err := a.requireSetupOnly(); err != nil {
		return nil, err
	}

	log := logger.WithComponent("app")
	log.Debug("getting certificate history", slog.String("hostname", hostname), slog.Int("limit", limit))

	a.mu.RLock()
	certificateService := a.certificateService
	a.mu.RUnlock()

	if certificateService == nil {
		return nil, fmt.Errorf("certificate service not initialized")
	}

	history, err := certificateService.GetHistory(a.ctx, hostname, limit)
	if err != nil {
		log.Error("get certificate history failed",
			slog.String("hostname", hostname),
			logger.Err(err),
		)
		return nil, err
	}

	log.Debug("certificate history retrieved",
		slog.String("hostname", hostname),
		slog.Int("count", len(history)),
	)
	return history, nil
}
