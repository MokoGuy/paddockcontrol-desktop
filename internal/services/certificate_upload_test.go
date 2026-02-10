package services

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"database/sql"
	"encoding/hex"
	"encoding/pem"
	"math/big"
	"testing"
	"time"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
)

// randomEncryptionKey generates a random 32-byte hex-encoded encryption key for testing
func randomEncryptionKey(t *testing.T) string {
	t.Helper()
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		t.Fatalf("failed to generate random encryption key: %v", err)
	}
	return hex.EncodeToString(b)
}

// selfSignCertFromCSR creates a self-signed certificate using the CSR's public key
func selfSignCertFromCSR(csrPEM []byte, signerKey *rsa.PrivateKey) (string, error) {
	csr, err := crypto.ParseCSR(csrPEM)
	if err != nil {
		return "", err
	}

	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      csr.Subject,
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		DNSNames:     csr.DNSNames,
		IPAddresses:  csr.IPAddresses,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, template, template, csr.PublicKey, signerKey)
	if err != nil {
		return "", err
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	return string(certPEM), nil
}

// setupTestService creates a CertificateService with an in-memory database
func setupTestService(t *testing.T) (*CertificateService, *db.Database) {
	t.Helper()
	database, err := db.NewDatabase(":memory:")
	if err != nil {
		t.Fatalf("failed to create database: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	configSvc := config.NewService(database)
	svc := NewCertificateService(database, configSvc)
	return svc, database
}

// generateTestCSRAndKey generates a 2048-bit RSA key, a CSR, and encrypts the key
func generateTestCSRAndKey(t *testing.T, hostname, encryptionKey string) (csrPEM []byte, encryptedKey []byte, privateKey *rsa.PrivateKey) {
	t.Helper()
	key, err := crypto.GenerateRSAKey(2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	csr, err := crypto.CreateCSR(crypto.CSRRequest{
		CommonName:   hostname,
		Organization: "Test Org",
		City:         "Test City",
		State:        "Test State",
		Country:      "FR",
	}, key)
	if err != nil {
		t.Fatalf("failed to create CSR: %v", err)
	}

	keyPEM, err := crypto.PrivateKeyToPEM(key)
	if err != nil {
		t.Fatalf("failed to convert key to PEM: %v", err)
	}

	encrypted, err := crypto.EncryptPrivateKey(keyPEM, encryptionKey)
	if err != nil {
		t.Fatalf("failed to encrypt private key: %v", err)
	}

	return csr, encrypted, key
}

func TestUploadCertificate_NewCSR_PreservesPrivateKey(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := randomEncryptionKey(t)

	// Generate CSR and key
	csrPEM, encryptedKey, privateKey := generateTestCSRAndKey(t, hostname, encryptionKey)

	// Create certificate with key in pending column (new cert flow after fix)
	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:                   hostname,
		PendingEncryptedPrivateKey: encryptedKey,
		PendingCsrPem:              sql.NullString{String: string(csrPEM), Valid: true},
		ReadOnly:                   0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	// Self-sign a certificate from the CSR
	certPEM, err := selfSignCertFromCSR(csrPEM, privateKey)
	if err != nil {
		t.Fatalf("failed to self-sign certificate: %v", err)
	}

	// Upload the signed certificate
	err = svc.UploadCertificate(ctx, hostname, certPEM, []byte(encryptionKey))
	if err != nil {
		t.Fatalf("UploadCertificate failed: %v", err)
	}

	// Verify the private key was moved to the active column
	cert, err := database.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		t.Fatalf("failed to get certificate: %v", err)
	}

	if len(cert.EncryptedPrivateKey) == 0 {
		t.Fatal("encrypted_private_key is NULL after upload — key was lost!")
	}

	// Verify the key is decryptable
	decrypted, err := crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, encryptionKey)
	if err != nil {
		t.Fatalf("failed to decrypt active private key: %v", err)
	}
	if len(decrypted) == 0 {
		t.Fatal("decrypted private key is empty")
	}

	// Verify pending columns are cleared
	if cert.PendingCsrPem.Valid {
		t.Error("pending_csr_pem should be NULL after activation")
	}
	if len(cert.PendingEncryptedPrivateKey) > 0 {
		t.Error("pending_encrypted_private_key should be NULL after activation")
	}

	// Verify certificate PEM is stored
	if !cert.CertificatePem.Valid || cert.CertificatePem.String == "" {
		t.Error("certificate_pem should be set after activation")
	}
}

func TestUploadCertificate_Renewal_PreservesPrivateKey(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := randomEncryptionKey(t)

	// Create an existing active certificate (simulating pre-renewal state)
	originalKey, _ := crypto.GenerateRSAKey(2048)
	originalKeyPEM, _ := crypto.PrivateKeyToPEM(originalKey)
	originalEncryptedKey, _ := crypto.EncryptPrivateKey(originalKeyPEM, encryptionKey)

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:            hostname,
		EncryptedPrivateKey: originalEncryptedKey,
		CertificatePem:      sql.NullString{String: "old-cert-pem", Valid: true},
		ReadOnly:            0,
	})
	if err != nil {
		t.Fatalf("failed to create original certificate: %v", err)
	}

	// Generate renewal CSR and key (stored in pending columns)
	renewalCSR, renewalEncryptedKey, renewalKey := generateTestCSRAndKey(t, hostname, encryptionKey)

	err = database.Queries().UpdatePendingCSR(ctx, sqlc.UpdatePendingCSRParams{
		Hostname:                   hostname,
		PendingCsrPem:              sql.NullString{String: string(renewalCSR), Valid: true},
		PendingEncryptedPrivateKey: renewalEncryptedKey,
	})
	if err != nil {
		t.Fatalf("failed to update pending CSR: %v", err)
	}

	// Self-sign a certificate from the renewal CSR
	certPEM, err := selfSignCertFromCSR(renewalCSR, renewalKey)
	if err != nil {
		t.Fatalf("failed to self-sign certificate: %v", err)
	}

	// Upload the signed certificate
	err = svc.UploadCertificate(ctx, hostname, certPEM, []byte(encryptionKey))
	if err != nil {
		t.Fatalf("UploadCertificate failed: %v", err)
	}

	// Verify the renewal key replaced the active key
	cert, err := database.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		t.Fatalf("failed to get certificate: %v", err)
	}

	if len(cert.EncryptedPrivateKey) == 0 {
		t.Fatal("encrypted_private_key is NULL after renewal upload — key was lost!")
	}

	// Verify it's the renewal key, not the original
	decrypted, err := crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, encryptionKey)
	if err != nil {
		t.Fatalf("failed to decrypt active private key: %v", err)
	}

	parsedKey, err := crypto.ParsePrivateKeyFromPEM(decrypted)
	if err != nil {
		t.Fatalf("failed to parse decrypted key: %v", err)
	}

	if !crypto.ComparePublicKeys(&parsedKey.PublicKey, &renewalKey.PublicKey) {
		t.Error("active key should be the renewal key, not the original key")
	}
}

func TestUploadCertificate_MissingPendingKey_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := randomEncryptionKey(t)

	// Generate CSR and key but only store CSR (simulating the bug scenario)
	csrPEM, _, privateKey := generateTestCSRAndKey(t, hostname, encryptionKey)

	// Create certificate with pending CSR but NO pending key (the bug scenario)
	originalKey, _ := crypto.GenerateRSAKey(2048)
	originalKeyPEM, _ := crypto.PrivateKeyToPEM(originalKey)
	originalEncryptedKey, _ := crypto.EncryptPrivateKey(originalKeyPEM, encryptionKey)

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:            hostname,
		EncryptedPrivateKey: originalEncryptedKey,
		PendingCsrPem:       sql.NullString{String: string(csrPEM), Valid: true},
		ReadOnly:            0,
		// PendingEncryptedPrivateKey intentionally not set (NULL)
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	// Self-sign a certificate
	certPEM, err := selfSignCertFromCSR(csrPEM, privateKey)
	if err != nil {
		t.Fatalf("failed to self-sign certificate: %v", err)
	}

	// Upload should fail with defensive error
	err = svc.UploadCertificate(ctx, hostname, certPEM, []byte(encryptionKey))
	if err == nil {
		t.Fatal("expected error when pending private key is missing, got nil")
	}

	expectedMsg := "pending private key is missing"
	if !containsSubstring(err.Error(), expectedMsg) {
		t.Errorf("expected error containing %q, got: %v", expectedMsg, err)
	}

	// Verify the original active key was NOT destroyed
	cert, err := database.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		t.Fatalf("failed to get certificate: %v", err)
	}

	if len(cert.EncryptedPrivateKey) == 0 {
		t.Fatal("original encrypted_private_key was destroyed despite the error!")
	}

	// Verify the original key is still decryptable
	_, err = crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, encryptionKey)
	if err != nil {
		t.Fatalf("original private key was corrupted: %v", err)
	}
}

func TestUploadCertificate_NoCSR_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := randomEncryptionKey(t)

	// Create certificate with no pending CSR
	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname: hostname,
		ReadOnly: 0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	err = svc.UploadCertificate(ctx, hostname, "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----", []byte(encryptionKey))
	if err == nil {
		t.Fatal("expected error when no pending CSR exists, got nil")
	}

	expectedMsg := "no pending CSR"
	if !containsSubstring(err.Error(), expectedMsg) {
		t.Errorf("expected error containing %q, got: %v", expectedMsg, err)
	}
}

func TestUploadCertificate_KeyMismatch_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := randomEncryptionKey(t)

	// Generate CSR and key for the pending state
	csrPEM, encryptedKey, _ := generateTestCSRAndKey(t, hostname, encryptionKey)

	// Create certificate with pending CSR and key
	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:                   hostname,
		PendingEncryptedPrivateKey: encryptedKey,
		PendingCsrPem:              sql.NullString{String: string(csrPEM), Valid: true},
		ReadOnly:                   0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	// Generate a DIFFERENT key and sign a certificate with it
	// This cert will not match the pending CSR or pending key
	wrongKey, err := crypto.GenerateRSAKey(2048)
	if err != nil {
		t.Fatalf("failed to generate wrong key: %v", err)
	}
	wrongCSR, err := crypto.CreateCSR(crypto.CSRRequest{
		CommonName:   hostname,
		Organization: "Wrong Org",
		City:         "Wrong City",
		State:        "Wrong State",
		Country:      "DE",
	}, wrongKey)
	if err != nil {
		t.Fatalf("failed to create wrong CSR: %v", err)
	}
	certPEM, err := selfSignCertFromCSR(wrongCSR, wrongKey)
	if err != nil {
		t.Fatalf("failed to self-sign certificate with wrong key: %v", err)
	}

	// Upload should fail because certificate doesn't match CSR
	err = svc.UploadCertificate(ctx, hostname, certPEM, []byte(encryptionKey))
	if err == nil {
		t.Fatal("expected error when certificate key doesn't match, got nil")
	}

	// It should fail on CSR match first (since the public keys differ)
	if !containsSubstring(err.Error(), "does not match CSR") {
		t.Errorf("expected error about CSR mismatch, got: %v", err)
	}
}

func TestPreviewCertificateUpload(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := randomEncryptionKey(t)

	// Generate CSR and key
	csrPEM, encryptedKey, privateKey := generateTestCSRAndKey(t, hostname, encryptionKey)

	// Create certificate with pending CSR
	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:                   hostname,
		PendingEncryptedPrivateKey: encryptedKey,
		PendingCsrPem:              sql.NullString{String: string(csrPEM), Valid: true},
		ReadOnly:                   0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	// Self-sign
	certPEM, err := selfSignCertFromCSR(csrPEM, privateKey)
	if err != nil {
		t.Fatalf("failed to self-sign certificate: %v", err)
	}

	// Preview
	preview, err := svc.PreviewCertificateUpload(ctx, hostname, certPEM, []byte(encryptionKey))
	if err != nil {
		t.Fatalf("PreviewCertificateUpload failed: %v", err)
	}

	if preview.Hostname != hostname {
		t.Errorf("expected hostname %q, got %q", hostname, preview.Hostname)
	}
	if !preview.CSRMatch {
		t.Error("expected CSRMatch to be true")
	}
	if !preview.KeyMatch {
		t.Error("expected KeyMatch to be true")
	}
	if preview.KeySize != 2048 {
		t.Errorf("expected key size 2048, got %d", preview.KeySize)
	}
	if preview.NotAfter == 0 {
		t.Error("expected NotAfter to be set")
	}
}

func TestPreviewCertificateUpload_KeyMismatch(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := randomEncryptionKey(t)

	// Generate CSR and key for pending state
	csrPEM, encryptedKey, _ := generateTestCSRAndKey(t, hostname, encryptionKey)

	// Create certificate with pending CSR and key
	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:                   hostname,
		PendingEncryptedPrivateKey: encryptedKey,
		PendingCsrPem:              sql.NullString{String: string(csrPEM), Valid: true},
		ReadOnly:                   0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	// Generate a DIFFERENT key and certificate
	wrongKey, err := crypto.GenerateRSAKey(2048)
	if err != nil {
		t.Fatalf("failed to generate wrong key: %v", err)
	}
	wrongCSR, err := crypto.CreateCSR(crypto.CSRRequest{
		CommonName:   hostname,
		Organization: "Wrong Org",
		City:         "Wrong City",
		State:        "Wrong State",
		Country:      "DE",
	}, wrongKey)
	if err != nil {
		t.Fatalf("failed to create wrong CSR: %v", err)
	}
	certPEM, err := selfSignCertFromCSR(wrongCSR, wrongKey)
	if err != nil {
		t.Fatalf("failed to self-sign certificate with wrong key: %v", err)
	}

	// Preview should succeed but show mismatches
	preview, err := svc.PreviewCertificateUpload(ctx, hostname, certPEM, []byte(encryptionKey))
	if err != nil {
		t.Fatalf("PreviewCertificateUpload failed: %v", err)
	}

	if preview.CSRMatch {
		t.Error("expected CSRMatch to be false for mismatched certificate")
	}
	if preview.KeyMatch {
		t.Error("expected KeyMatch to be false for mismatched certificate")
	}
}

func containsSubstring(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
