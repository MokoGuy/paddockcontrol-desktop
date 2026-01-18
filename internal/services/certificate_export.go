package services

import (
	"context"
	"fmt"

	"paddockcontrol-desktop/internal/crypto"
)

// GetCSRForDownload returns the CSR PEM for download
func (s *CertificateService) GetCSRForDownload(ctx context.Context, hostname string) (string, error) {
	cert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return "", fmt.Errorf("failed to get certificate: %w", err)
	}

	if !cert.PendingCsrPem.Valid || cert.PendingCsrPem.String == "" {
		return "", fmt.Errorf("no pending CSR for hostname: %s", hostname)
	}

	return cert.PendingCsrPem.String, nil
}

// GetCertificateForDownload returns the certificate PEM for download
func (s *CertificateService) GetCertificateForDownload(ctx context.Context, hostname string) (string, error) {
	cert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return "", fmt.Errorf("failed to get certificate: %w", err)
	}

	if !cert.CertificatePem.Valid || cert.CertificatePem.String == "" {
		return "", fmt.Errorf("no certificate for hostname: %s", hostname)
	}

	return cert.CertificatePem.String, nil
}

// GetPrivateKeyForDownload returns the decrypted private key PEM for download
func (s *CertificateService) GetPrivateKeyForDownload(ctx context.Context, hostname string, encryptionKey []byte) (string, error) {
	cert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return "", fmt.Errorf("failed to get certificate: %w", err)
	}

	if len(cert.EncryptedPrivateKey) == 0 {
		return "", fmt.Errorf("no private key for hostname: %s", hostname)
	}

	// Decrypt private key
	decryptedKey, err := crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, string(encryptionKey))
	if err != nil {
		return "", fmt.Errorf("failed to decrypt private key: %w", err)
	}

	return string(decryptedKey), nil
}
