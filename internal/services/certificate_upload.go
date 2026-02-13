package services

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"
)

// UploadCertificate uploads and activates a signed certificate
func (s *CertificateService) UploadCertificate(ctx context.Context, hostname, certPEM string, encryptionKey []byte) error {
	log := logger.WithComponent("certificate")
	log = logger.WithHostname(log, hostname)
	log.Info("starting certificate upload")

	// Get pending certificate
	cert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return fmt.Errorf("failed to get certificate: %w", err)
	}

	// Verify has pending CSR
	if !cert.PendingCsrPem.Valid || cert.PendingCsrPem.String == "" {
		return fmt.Errorf("no pending CSR for hostname: %s", hostname)
	}

	// Guard against invalid state: pending private key must exist to avoid destroying the active key
	if len(cert.PendingEncryptedPrivateKey) == 0 {
		return fmt.Errorf("cannot activate certificate: pending private key is missing for hostname: %s", hostname)
	}

	// Parse certificate and CSR to validate match
	parsedCert, err := crypto.ParseCertificate([]byte(certPEM))
	if err != nil {
		return fmt.Errorf("invalid certificate: %w", err)
	}

	parsedCSR, err := crypto.ParseCSR([]byte(cert.PendingCsrPem.String))
	if err != nil {
		return fmt.Errorf("invalid pending CSR: %w", err)
	}

	// Validate certificate matches CSR
	if err := crypto.ValidateCSRMatch(parsedCSR, parsedCert); err != nil {
		log.Warn("CSR match validation failed", logger.Err(err))
		return fmt.Errorf("certificate does not match CSR: %w", err)
	}
	log.Info("CSR match validated")

	// Validate certificate matches pending private key
	decryptedKeyPEM, err := crypto.DecryptPrivateKey(cert.PendingEncryptedPrivateKey, encryptionKey)
	if err != nil {
		return fmt.Errorf("failed to decrypt pending private key: %w", err)
	}
	privateKey, err := crypto.ParsePrivateKeyFromPEM(decryptedKeyPEM)
	if err != nil {
		return fmt.Errorf("failed to parse pending private key: %w", err)
	}
	certPubKey, err := crypto.ExtractPublicKey(parsedCert)
	if err != nil {
		return fmt.Errorf("failed to extract certificate public key: %w", err)
	}
	if !crypto.ComparePublicKeys(certPubKey, &privateKey.PublicKey) {
		log.Warn("certificate public key does not match pending private key")
		return fmt.Errorf("certificate public key does not match pending private key")
	}
	log.Info("key match validated")

	// Extract expiration date
	expiresAt := parsedCert.NotAfter.Unix()

	// Update in database
	log.Info("activating certificate", slog.Int64("expires_at", expiresAt))
	err = s.db.Queries().ActivateCertificate(ctx, sqlc.ActivateCertificateParams{
		Hostname:       hostname,
		CertificatePem: sql.NullString{String: certPEM, Valid: true},
		ExpiresAt:      sql.NullInt64{Int64: expiresAt, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to activate certificate: %w", err)
	}

	// Log history entry
	expiresDate := time.Unix(expiresAt, 0).Format("2006-01-02")
	message := fmt.Sprintf("Certificate uploaded (expires %s)", expiresDate)
	_ = s.history.LogEvent(ctx, hostname, models.EventCertificateUploaded, message)

	log.Info("certificate uploaded successfully", slog.String("expires", expiresDate))
	return nil
}

// PreviewCertificateUpload validates and returns metadata about a signed certificate without storing it
func (s *CertificateService) PreviewCertificateUpload(ctx context.Context, hostname, certPEM string, encryptionKey []byte) (*models.CertificateUploadPreview, error) {
	log := logger.WithComponent("certificate")
	log = logger.WithHostname(log, hostname)
	log.Info("previewing certificate upload")

	// Get pending certificate
	cert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return nil, fmt.Errorf("failed to get certificate: %w", err)
	}

	// Verify has pending CSR
	if !cert.PendingCsrPem.Valid || cert.PendingCsrPem.String == "" {
		return nil, fmt.Errorf("no pending CSR for hostname: %s", hostname)
	}

	// Parse certificate
	parsedCert, err := crypto.ParseCertificate([]byte(certPEM))
	if err != nil {
		return nil, fmt.Errorf("invalid certificate: %w", err)
	}

	// Parse CSR
	parsedCSR, err := crypto.ParseCSR([]byte(cert.PendingCsrPem.String))
	if err != nil {
		return nil, fmt.Errorf("invalid pending CSR: %w", err)
	}

	// Check CSR match
	csrMatch := crypto.ValidateCSRMatch(parsedCSR, parsedCert) == nil

	// Check key match: cert public key matches pending private key
	keyMatch := false
	if len(cert.PendingEncryptedPrivateKey) > 0 {
		decryptedKeyPEM, err := crypto.DecryptPrivateKey(cert.PendingEncryptedPrivateKey, encryptionKey)
		if err == nil {
			privateKey, err := crypto.ParsePrivateKeyFromPEM(decryptedKeyPEM)
			if err == nil {
				certPubKey, err := crypto.ExtractPublicKey(parsedCert)
				if err == nil {
					keyMatch = crypto.ComparePublicKeys(certPubKey, &privateKey.PublicKey)
				}
			}
		}
	}

	log.Info("preview validation complete",
		slog.Bool("csr_match", csrMatch),
		slog.Bool("key_match", keyMatch),
	)

	// Extract details
	details, err := crypto.ExtractCertificateDetails(parsedCert)
	if err != nil {
		return nil, fmt.Errorf("failed to extract certificate details: %w", err)
	}

	preview := &models.CertificateUploadPreview{
		Hostname:  details.Hostname,
		NotBefore: parsedCert.NotBefore.Unix(),
		NotAfter:  parsedCert.NotAfter.Unix(),
		SANs:      details.SANs,
		KeySize:   details.KeySize,
		CSRMatch:  csrMatch,
		KeyMatch:  keyMatch,
	}

	// Extract issuer info
	if len(parsedCert.Issuer.CommonName) > 0 {
		preview.IssuerCN = parsedCert.Issuer.CommonName
	}
	if len(parsedCert.Issuer.Organization) > 0 {
		preview.IssuerO = parsedCert.Issuer.Organization[0]
	}

	return preview, nil
}

// ImportCertificate imports a certificate with its private key
func (s *CertificateService) ImportCertificate(ctx context.Context, req models.ImportRequest, encryptionKey []byte) error {
	// Validate cert and key match
	if err := crypto.ValidateCertificateAndKey(req.CertificatePEM, req.PrivateKeyPEM); err != nil {
		return fmt.Errorf("certificate and key validation failed: %w", err)
	}

	// Parse certificate to extract metadata
	parsedCert, err := crypto.ParseCertificate([]byte(req.CertificatePEM))
	if err != nil {
		return fmt.Errorf("invalid certificate: %w", err)
	}

	// Extract hostname from certificate CN
	hostname := parsedCert.Subject.CommonName
	if hostname == "" {
		return fmt.Errorf("certificate has no common name")
	}

	// Parse private key
	privateKey, err := crypto.ParsePrivateKeyFromPEM([]byte(req.PrivateKeyPEM))
	if err != nil {
		return fmt.Errorf("invalid private key: %w", err)
	}

	// Convert to PEM if needed
	keyPEM, err := crypto.PrivateKeyToPEM(privateKey)
	if err != nil {
		return fmt.Errorf("failed to encode private key: %w", err)
	}

	// Encrypt private key
	encryptedKey, err := crypto.EncryptPrivateKey(keyPEM, encryptionKey)
	if err != nil {
		return fmt.Errorf("failed to encrypt private key: %w", err)
	}

	// Check for duplicates
	exists, err := s.db.Queries().CertificateExists(ctx, hostname)
	if err != nil {
		return fmt.Errorf("failed to check certificate existence: %w", err)
	}
	if exists == 1 {
		return fmt.Errorf("certificate already exists for hostname: %s", hostname)
	}

	// Extract expiration date
	expiresAt := parsedCert.NotAfter.Unix()

	// Store in database
	err = s.db.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:            hostname,
		EncryptedPrivateKey: encryptedKey,
		CertificatePem:      sql.NullString{String: req.CertificatePEM, Valid: true},
		ExpiresAt:           sql.NullInt64{Int64: expiresAt, Valid: true},
		Note:                sql.NullString{String: req.Note, Valid: req.Note != ""},
		ReadOnly:            0,
	})
	if err != nil {
		return fmt.Errorf("failed to import certificate: %w", err)
	}

	// Log history entry
	expiresDate := time.Unix(expiresAt, 0).Format("2006-01-02")
	message := fmt.Sprintf("Certificate imported (expires %s)", expiresDate)
	_ = s.history.LogEvent(ctx, hostname, models.EventCertificateImported, message)

	return nil
}
