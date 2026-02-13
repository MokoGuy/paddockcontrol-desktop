package services

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/testutil"
)

func TestGetCSRForDownload_Success(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := testutil.RandomMasterKey(t)

	csrPEM, encryptedKey, _ := generateTestCSRAndKey(t, hostname, encryptionKey)

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:                   hostname,
		PendingEncryptedPrivateKey: encryptedKey,
		PendingCsrPem:              sql.NullString{String: string(csrPEM), Valid: true},
		ReadOnly:                   0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	result, err := svc.GetCSRForDownload(ctx, hostname)
	if err != nil {
		t.Fatalf("GetCSRForDownload failed: %v", err)
	}

	if result != string(csrPEM) {
		t.Error("returned CSR does not match stored CSR")
	}
	if !strings.Contains(result, "BEGIN CERTIFICATE REQUEST") {
		t.Error("expected CSR PEM header")
	}
}

func TestGetCSRForDownload_NoCSR_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname: hostname,
		ReadOnly: 0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	_, err = svc.GetCSRForDownload(ctx, hostname)
	if err == nil {
		t.Fatal("expected error when no CSR exists, got nil")
	}
	if !containsSubstring(err.Error(), "no pending CSR") {
		t.Errorf("expected error about no pending CSR, got: %v", err)
	}
}

func TestGetCSRForDownload_NotFound_ReturnsError(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	_, err := svc.GetCSRForDownload(ctx, "nonexistent.example.com")
	if err == nil {
		t.Fatal("expected error for non-existent hostname, got nil")
	}
}

func TestGetCertificateForDownload_Success(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := testutil.RandomMasterKey(t)

	csrPEM, encryptedKey, privateKey := generateTestCSRAndKey(t, hostname, encryptionKey)
	certPEM, err := selfSignCertFromCSR(csrPEM, privateKey)
	if err != nil {
		t.Fatalf("failed to self-sign certificate: %v", err)
	}

	err = database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:            hostname,
		EncryptedPrivateKey: encryptedKey,
		CertificatePem:      sql.NullString{String: certPEM, Valid: true},
		ReadOnly:            0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	result, err := svc.GetCertificateForDownload(ctx, hostname)
	if err != nil {
		t.Fatalf("GetCertificateForDownload failed: %v", err)
	}

	if result != certPEM {
		t.Error("returned certificate does not match stored certificate")
	}
	if !strings.Contains(result, "BEGIN CERTIFICATE") {
		t.Error("expected certificate PEM header")
	}
}

func TestGetCertificateForDownload_NoCertificate_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname: hostname,
		ReadOnly: 0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	_, err = svc.GetCertificateForDownload(ctx, hostname)
	if err == nil {
		t.Fatal("expected error when no certificate exists, got nil")
	}
	if !containsSubstring(err.Error(), "no certificate") {
		t.Errorf("expected error about no certificate, got: %v", err)
	}
}

func TestGetCertificateForDownload_NotFound_ReturnsError(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	_, err := svc.GetCertificateForDownload(ctx, "nonexistent.example.com")
	if err == nil {
		t.Fatal("expected error for non-existent hostname, got nil")
	}
}

func TestGetPrivateKeyForDownload_Success(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := testutil.RandomMasterKey(t)

	_, encryptedKey, _ := generateTestCSRAndKey(t, hostname, encryptionKey)

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:            hostname,
		EncryptedPrivateKey: encryptedKey,
		ReadOnly:            0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	result, err := svc.GetPrivateKeyForDownload(ctx, hostname, encryptionKey)
	if err != nil {
		t.Fatalf("GetPrivateKeyForDownload failed: %v", err)
	}

	if !strings.Contains(result, "PRIVATE KEY") {
		t.Error("expected private key PEM header")
	}
}

func TestGetPrivateKeyForDownload_NoKey_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname: hostname,
		ReadOnly: 0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	_, err = svc.GetPrivateKeyForDownload(ctx, hostname, []byte("somekey"))
	if err == nil {
		t.Fatal("expected error when no private key exists, got nil")
	}
	if !containsSubstring(err.Error(), "no private key") {
		t.Errorf("expected error about no private key, got: %v", err)
	}
}

func TestGetPrivateKeyForDownload_WrongKey_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := testutil.RandomMasterKey(t)
	wrongKey := testutil.RandomMasterKey(t)

	key, err := crypto.GenerateRSAKey(2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}
	keyPEM, err := crypto.PrivateKeyToPEM(key)
	if err != nil {
		t.Fatalf("failed to convert key to PEM: %v", err)
	}
	encrypted, err := crypto.EncryptPrivateKey(keyPEM, encryptionKey)
	if err != nil {
		t.Fatalf("failed to encrypt key: %v", err)
	}

	err = database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:            hostname,
		EncryptedPrivateKey: encrypted,
		ReadOnly:            0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	_, err = svc.GetPrivateKeyForDownload(ctx, hostname, wrongKey)
	if err == nil {
		t.Fatal("expected error with wrong encryption key, got nil")
	}
	if !containsSubstring(err.Error(), "decrypt") {
		t.Errorf("expected decrypt error, got: %v", err)
	}
}

func TestGetPendingPrivateKeyForDownload_Success(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := testutil.RandomMasterKey(t)

	_, encryptedKey, _ := generateTestCSRAndKey(t, hostname, encryptionKey)

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:                   hostname,
		PendingEncryptedPrivateKey: encryptedKey,
		ReadOnly:                   0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	result, err := svc.GetPendingPrivateKeyForDownload(ctx, hostname, encryptionKey)
	if err != nil {
		t.Fatalf("GetPendingPrivateKeyForDownload failed: %v", err)
	}

	if !strings.Contains(result, "PRIVATE KEY") {
		t.Error("expected private key PEM header")
	}
}

func TestGetPendingPrivateKeyForDownload_NoKey_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname: hostname,
		ReadOnly: 0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	_, err = svc.GetPendingPrivateKeyForDownload(ctx, hostname, []byte("somekey"))
	if err == nil {
		t.Fatal("expected error when no pending private key exists, got nil")
	}
	if !containsSubstring(err.Error(), "no pending private key") {
		t.Errorf("expected error about no pending private key, got: %v", err)
	}
}

func TestGetPendingPrivateKeyForDownload_WrongKey_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := testutil.RandomMasterKey(t)
	wrongKey := testutil.RandomMasterKey(t)

	_, encryptedKey, _ := generateTestCSRAndKey(t, hostname, encryptionKey)

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:                   hostname,
		PendingEncryptedPrivateKey: encryptedKey,
		ReadOnly:                   0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	_, err = svc.GetPendingPrivateKeyForDownload(ctx, hostname, wrongKey)
	if err == nil {
		t.Fatal("expected error with wrong encryption key, got nil")
	}
	if !containsSubstring(err.Error(), "decrypt") {
		t.Errorf("expected decrypt error, got: %v", err)
	}
}
