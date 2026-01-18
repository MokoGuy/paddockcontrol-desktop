package services

import (
	"context"
	"database/sql"
	"fmt"

	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
)

// UploadCertificate uploads and activates a signed certificate
func (s *CertificateService) UploadCertificate(ctx context.Context, hostname, certPEM string) error {
	// Get pending certificate
	cert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return fmt.Errorf("failed to get certificate: %w", err)
	}

	// Verify has pending CSR
	if !cert.PendingCsrPem.Valid || cert.PendingCsrPem.String == "" {
		return fmt.Errorf("no pending CSR for hostname: %s", hostname)
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
		return fmt.Errorf("certificate does not match CSR: %w", err)
	}

	// Extract expiration date
	expiresAt := parsedCert.NotAfter.Unix()

	// Update in database
	err = s.db.Queries().ActivateCertificate(ctx, sqlc.ActivateCertificateParams{
		Hostname:       hostname,
		CertificatePem: sql.NullString{String: certPEM, Valid: true},
		ExpiresAt:      sql.NullInt64{Int64: expiresAt, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to activate certificate: %w", err)
	}

	return nil
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
	encryptedKey, err := crypto.EncryptPrivateKey(keyPEM, string(encryptionKey))
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

	return nil
}
