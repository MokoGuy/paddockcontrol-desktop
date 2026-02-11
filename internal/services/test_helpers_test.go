package services

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"database/sql"
	"encoding/pem"
	"math/big"
	"testing"
	"time"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
	"paddockcontrol-desktop/internal/testutil"
)

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

// containsSubstring checks if s contains substr
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

// setupTestConfig seeds a config row in the database (needed by GenerateCSR, ExportBackup)
func setupTestConfig(t *testing.T, database *db.Database) {
	t.Helper()
	ctx := context.Background()
	err := database.Queries().CreateConfig(ctx, sqlc.CreateConfigParams{
		OwnerEmail:                "test@example.com",
		CaName:                    "Test CA",
		HostnameSuffix:            ".example.com",
		DefaultOrganization:       "Test Org",
		DefaultOrganizationalUnit: sql.NullString{String: "Test Unit", Valid: true},
		DefaultCity:               "Test City",
		DefaultState:              "Test State",
		DefaultCountry:            "FR",
		DefaultKeySize:            2048,
		ValidityPeriodDays:        365,
	})
	if err != nil {
		t.Fatalf("failed to create test config: %v", err)
	}
	err = database.Queries().SetConfigured(ctx)
	if err != nil {
		t.Fatalf("failed to set configured: %v", err)
	}
}

// setupBackupService creates a BackupService with an in-memory database
func setupBackupService(t *testing.T) (*BackupService, *db.Database) {
	t.Helper()
	database, err := db.NewDatabase(":memory:")
	if err != nil {
		t.Fatalf("failed to create database: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	svc := NewBackupService(database)
	return svc, database
}

// setupSetupService creates a SetupService with all dependencies
func setupSetupService(t *testing.T) (*SetupService, *db.Database) {
	t.Helper()
	database, err := db.NewDatabase(":memory:")
	if err != nil {
		t.Fatalf("failed to create database: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	configSvc := config.NewService(database)
	backupSvc := NewBackupService(database)
	svc := NewSetupService(database, configSvc, backupSvc)
	return svc, database
}

// makeTestSetupRequest returns a valid SetupRequest
func makeTestSetupRequest() models.SetupRequest {
	return models.SetupRequest{
		OwnerEmail:         "admin@example.com",
		CAName:             "Test CA",
		HostnameSuffix:     ".example.com",
		ValidityPeriodDays: 365,
		DefaultOrganization: "Test Org",
		DefaultCity:         "Paris",
		DefaultState:        "IDF",
		DefaultCountry:      "FR",
		DefaultKeySize:      4096,
	}
}

// makeTestBackupWithConfig returns a BackupData with config and the given certificates
func makeTestBackupWithConfig(certs []*models.BackupCertificate) *models.BackupData {
	return &models.BackupData{
		Version:    "1.0",
		ExportedAt: time.Now().Unix(),
		Config: &models.Config{
			OwnerEmail:         "admin@example.com",
			CAName:             "Backup CA",
			HostnameSuffix:     ".example.com",
			ValidityPeriodDays: 365,
			DefaultOrganization: "Backup Org",
			DefaultCity:         "Paris",
			DefaultState:        "IDF",
			DefaultCountry:      "FR",
			DefaultKeySize:      4096,
		},
		Certificates: certs,
	}
}

// Ensure testutil import is used (provides RandomEncryptionKey)
var _ = testutil.RandomEncryptionKey
