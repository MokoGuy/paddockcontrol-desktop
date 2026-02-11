package services

import (
	"context"
	"database/sql"
	"testing"

	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
	"paddockcontrol-desktop/internal/testutil"
)

// ============================================================================
// ClearPendingCSR Tests
// ============================================================================

func TestClearPendingCSR_Success(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "test.example.com"
	encryptionKey := testutil.RandomEncryptionKey(t)

	// Create an active certificate with a pending renewal CSR
	_, encryptedKey, _ := generateTestCSRAndKey(t, hostname, encryptionKey)
	renewalCSR, renewalEncryptedKey, _ := generateTestCSRAndKey(t, hostname, encryptionKey)

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:            hostname,
		EncryptedPrivateKey: encryptedKey,
		CertificatePem:      sql.NullString{String: "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----", Valid: true},
		PendingCsrPem:       sql.NullString{String: string(renewalCSR), Valid: true},
		PendingEncryptedPrivateKey: renewalEncryptedKey,
		PendingNote:         sql.NullString{String: "renewal note", Valid: true},
		ReadOnly:            0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	// Clear the pending CSR
	err = svc.ClearPendingCSR(ctx, hostname)
	if err != nil {
		t.Fatalf("ClearPendingCSR failed: %v", err)
	}

	// Verify pending columns are cleared
	cert, err := database.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		t.Fatalf("failed to get certificate: %v", err)
	}

	if cert.PendingCsrPem.Valid {
		t.Error("pending_csr_pem should be NULL after clear")
	}
	if len(cert.PendingEncryptedPrivateKey) > 0 {
		t.Error("pending_encrypted_private_key should be NULL after clear")
	}
	if cert.PendingNote.Valid {
		t.Error("pending_note should be NULL after clear")
	}

	// Verify active certificate and key are untouched
	if !cert.CertificatePem.Valid || cert.CertificatePem.String == "" {
		t.Error("certificate_pem should still be set")
	}
	if len(cert.EncryptedPrivateKey) == 0 {
		t.Error("encrypted_private_key should still be set")
	}
}

func TestClearPendingCSR_ReadOnly_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "readonly.example.com"
	encryptionKey := testutil.RandomEncryptionKey(t)

	csrPEM, encryptedKey, _ := generateTestCSRAndKey(t, hostname, encryptionKey)

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:                   hostname,
		PendingCsrPem:              sql.NullString{String: string(csrPEM), Valid: true},
		PendingEncryptedPrivateKey: encryptedKey,
		ReadOnly:                   1,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	err = svc.ClearPendingCSR(ctx, hostname)
	if err == nil {
		t.Fatal("expected error for read-only certificate, got nil")
	}
	if !containsSubstring(err.Error(), "read-only") {
		t.Errorf("expected error containing %q, got: %v", "read-only", err)
	}

	// Verify pending CSR is still intact
	cert, err := database.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		t.Fatalf("failed to get certificate: %v", err)
	}
	if !cert.PendingCsrPem.Valid || cert.PendingCsrPem.String == "" {
		t.Error("pending CSR should still be intact after read-only rejection")
	}
}

func TestClearPendingCSR_NoPendingCSR_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "nocsr.example.com"

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname: hostname,
		ReadOnly: 0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	err = svc.ClearPendingCSR(ctx, hostname)
	if err == nil {
		t.Fatal("expected error when no pending CSR exists, got nil")
	}
	if !containsSubstring(err.Error(), "no pending CSR") {
		t.Errorf("expected error containing %q, got: %v", "no pending CSR", err)
	}
}

func TestClearPendingCSR_NotFound_ReturnsError(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	err := svc.ClearPendingCSR(ctx, "nonexistent.example.com")
	if err == nil {
		t.Fatal("expected error for non-existent hostname, got nil")
	}
}

func TestClearPendingCSR_LogsHistoryEvent(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "history.example.com"
	encryptionKey := testutil.RandomEncryptionKey(t)

	csrPEM, encryptedKey, _ := generateTestCSRAndKey(t, hostname, encryptionKey)

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:                   hostname,
		PendingCsrPem:              sql.NullString{String: string(csrPEM), Valid: true},
		PendingEncryptedPrivateKey: encryptedKey,
		ReadOnly:                   0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	err = svc.ClearPendingCSR(ctx, hostname)
	if err != nil {
		t.Fatalf("ClearPendingCSR failed: %v", err)
	}

	// Verify history event was logged
	history, err := database.Queries().GetCertificateHistory(ctx, sqlc.GetCertificateHistoryParams{
		Hostname: hostname,
		Limit:    10,
	})
	if err != nil {
		t.Fatalf("failed to get history: %v", err)
	}

	if len(history) == 0 {
		t.Fatal("expected at least one history entry, got none")
	}

	found := false
	for _, entry := range history {
		if entry.EventType == models.EventPendingCSRRemoved {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected history entry with event_type %q, not found", models.EventPendingCSRRemoved)
	}
}

// ============================================================================
// ListCertificates HasPendingCSR Tests
// ============================================================================

func TestListCertificates_HasPendingCSR_True(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "pending.example.com"
	encryptionKey := testutil.RandomEncryptionKey(t)

	csrPEM, encryptedKey, _ := generateTestCSRAndKey(t, hostname, encryptionKey)

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:                   hostname,
		CertificatePem:             sql.NullString{String: "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----", Valid: true},
		PendingCsrPem:              sql.NullString{String: string(csrPEM), Valid: true},
		PendingEncryptedPrivateKey: encryptedKey,
		ReadOnly:                   0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	items, err := svc.ListCertificates(ctx, models.CertificateFilter{})
	if err != nil {
		t.Fatalf("ListCertificates failed: %v", err)
	}

	if len(items) != 1 {
		t.Fatalf("expected 1 certificate, got %d", len(items))
	}
	if !items[0].HasPendingCSR {
		t.Error("expected HasPendingCSR to be true for certificate with pending CSR")
	}
}

func TestListCertificates_HasPendingCSR_False(t *testing.T) {
	svc, database := setupTestService(t)
	ctx := context.Background()
	hostname := "nopending.example.com"

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname: hostname,
		ReadOnly: 0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	items, err := svc.ListCertificates(ctx, models.CertificateFilter{})
	if err != nil {
		t.Fatalf("ListCertificates failed: %v", err)
	}

	if len(items) != 1 {
		t.Fatalf("expected 1 certificate, got %d", len(items))
	}
	if items[0].HasPendingCSR {
		t.Error("expected HasPendingCSR to be false for certificate without pending CSR")
	}
}
