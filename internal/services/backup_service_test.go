package services

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
	"paddockcontrol-desktop/internal/testutil"
)

func TestExportBackup_WithKeys(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	csrPEM, encryptedKey, _ := generateTestCSRAndKey(t, "server.example.com", encryptionKey)

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:                   "server.example.com",
		EncryptedPrivateKey:        encryptedKey,
		PendingCsrPem:              sql.NullString{String: string(csrPEM), Valid: true},
		PendingEncryptedPrivateKey: encryptedKey,
		ReadOnly:                   0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	backup, err := svc.ExportBackup(ctx, true)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	if len(backup.Certificates) != 1 {
		t.Fatalf("expected 1 certificate, got %d", len(backup.Certificates))
	}
	if len(backup.Certificates[0].EncryptedKey) == 0 {
		t.Error("expected encrypted key in backup when includeKeys=true")
	}
	if len(backup.Certificates[0].PendingEncryptedKey) == 0 {
		t.Error("expected pending encrypted key in backup when includeKeys=true")
	}
}

func TestExportBackup_WithoutKeys(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	_, encryptedKey, _ := generateTestCSRAndKey(t, "server.example.com", encryptionKey)

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:            "server.example.com",
		EncryptedPrivateKey: encryptedKey,
		ReadOnly:            0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	backup, err := svc.ExportBackup(ctx, false)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	if len(backup.Certificates) != 1 {
		t.Fatalf("expected 1 certificate, got %d", len(backup.Certificates))
	}
	if len(backup.Certificates[0].EncryptedKey) != 0 {
		t.Error("expected no encrypted key in backup when includeKeys=false")
	}
}

func TestExportBackup_IncludesConfig(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()

	backup, err := svc.ExportBackup(ctx, false)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	if backup.Config == nil {
		t.Fatal("expected config in backup")
	}
	if backup.Config.OwnerEmail != "test@example.com" {
		t.Errorf("expected owner email test@example.com, got %s", backup.Config.OwnerEmail)
	}
	if backup.Config.CAName != "Test CA" {
		t.Errorf("expected CA name 'Test CA', got %s", backup.Config.CAName)
	}
	if backup.Version != "1.0" {
		t.Errorf("expected version 1.0, got %s", backup.Version)
	}
}

func TestExportBackup_IncludesPendingCSR(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	csrPEM, encryptedKey, _ := generateTestCSRAndKey(t, "server.example.com", encryptionKey)

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:                   "server.example.com",
		PendingCsrPem:              sql.NullString{String: string(csrPEM), Valid: true},
		PendingEncryptedPrivateKey: encryptedKey,
		ReadOnly:                   0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	backup, err := svc.ExportBackup(ctx, true)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	if backup.Certificates[0].PendingCSR != string(csrPEM) {
		t.Error("expected pending CSR in backup")
	}
	if len(backup.Certificates[0].PendingEncryptedKey) == 0 {
		t.Error("expected pending encrypted key in backup")
	}
}

func TestExportBackup_IncludesNotes(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:    "server.example.com",
		Note:        sql.NullString{String: "active note", Valid: true},
		PendingNote: sql.NullString{String: "pending note", Valid: true},
		ReadOnly:    0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	backup, err := svc.ExportBackup(ctx, false)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	if backup.Certificates[0].Note != "active note" {
		t.Errorf("expected note 'active note', got %s", backup.Certificates[0].Note)
	}
	if backup.Certificates[0].PendingNote != "pending note" {
		t.Errorf("expected pending note 'pending note', got %s", backup.Certificates[0].PendingNote)
	}
}

func TestExportBackup_EmptyDatabase(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()

	backup, err := svc.ExportBackup(ctx, true)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	if len(backup.Certificates) != 0 {
		t.Errorf("expected 0 certificates, got %d", len(backup.Certificates))
	}
	if backup.Config == nil {
		t.Error("expected config even with empty database")
	}
}

func TestExportBackup_PreservesReadOnlyFlag(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()

	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname: "readonly.example.com",
		ReadOnly: 1,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	backup, err := svc.ExportBackup(ctx, false)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	if !backup.Certificates[0].ReadOnly {
		t.Error("expected ReadOnly to be true in backup")
	}
}

func TestImportBackup_Success(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()

	backup := &models.BackupData{
		Version:    "1.0",
		ExportedAt: time.Now().Unix(),
		Certificates: []*models.BackupCertificate{
			{Hostname: "server1.example.com", CertificatePEM: "cert-pem-1", CreatedAt: time.Now().Unix()},
			{Hostname: "server2.example.com", CertificatePEM: "cert-pem-2", CreatedAt: time.Now().Unix()},
		},
	}

	result, err := svc.ImportBackup(ctx, backup, nil)
	if err != nil {
		t.Fatalf("ImportBackup failed: %v", err)
	}

	if result.Success != 2 {
		t.Errorf("expected 2 successful imports, got %d", result.Success)
	}

	// Verify both are in DB
	cert1, err := database.Queries().GetCertificateByHostname(ctx, "server1.example.com")
	if err != nil {
		t.Fatalf("failed to get server1: %v", err)
	}
	if !cert1.CertificatePem.Valid || cert1.CertificatePem.String != "cert-pem-1" {
		t.Error("expected cert PEM for server1")
	}
}

func TestImportBackup_WithEncryptedKeys(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	_, encryptedKey, _ := generateTestCSRAndKey(t, "server.example.com", encryptionKey)

	backup := &models.BackupData{
		Version:    "1.0",
		ExportedAt: time.Now().Unix(),
		Certificates: []*models.BackupCertificate{
			{
				Hostname:     "server.example.com",
				EncryptedKey: encryptedKey,
				CreatedAt:    time.Now().Unix(),
			},
		},
	}

	result, err := svc.ImportBackup(ctx, backup, encryptionKey)
	if err != nil {
		t.Fatalf("ImportBackup failed: %v", err)
	}
	if result.Success != 1 {
		t.Errorf("expected 1 successful import, got %d", result.Success)
	}

	// Verify key is stored and decryptable
	cert, err := database.Queries().GetCertificateByHostname(ctx, "server.example.com")
	if err != nil {
		t.Fatalf("failed to get certificate: %v", err)
	}
	_, err = crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, encryptionKey)
	if err != nil {
		t.Fatalf("failed to decrypt imported key: %v", err)
	}
}

func TestImportBackup_DuplicateHostname_ReturnsError(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()

	// Create existing certificate
	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname: "server.example.com",
		ReadOnly: 0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	backup := &models.BackupData{
		Version:    "1.0",
		ExportedAt: time.Now().Unix(),
		Certificates: []*models.BackupCertificate{
			{Hostname: "server.example.com", CreatedAt: time.Now().Unix()},
		},
	}

	_, err = svc.ImportBackup(ctx, backup, nil)
	if err == nil {
		t.Fatal("expected error for duplicate hostname, got nil")
	}
	if !containsSubstring(err.Error(), "already exists") {
		t.Errorf("expected duplicate error, got: %v", err)
	}
}

func TestImportBackup_WrongEncryptionKey_ReturnsError(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)
	wrongKey := testutil.RandomMasterKey(t)

	_, encryptedKey, _ := generateTestCSRAndKey(t, "server.example.com", encryptionKey)

	backup := &models.BackupData{
		Version:    "1.0",
		ExportedAt: time.Now().Unix(),
		Certificates: []*models.BackupCertificate{
			{
				Hostname:     "server.example.com",
				EncryptedKey: encryptedKey,
				CreatedAt:    time.Now().Unix(),
			},
		},
	}

	_, err := svc.ImportBackup(ctx, backup, wrongKey)
	if err == nil {
		t.Fatal("expected error with wrong encryption key, got nil")
	}
	if !containsSubstring(err.Error(), "encryption key may be incorrect") {
		t.Errorf("expected encryption key error, got: %v", err)
	}
}

func TestImportBackup_NilBackup_ReturnsError(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()

	_, err := svc.ImportBackup(ctx, nil, nil)
	if err == nil {
		t.Fatal("expected error for nil backup, got nil")
	}
	if !containsSubstring(err.Error(), "nil") {
		t.Errorf("expected nil error, got: %v", err)
	}
}

func TestImportBackup_MissingVersion_ReturnsError(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()

	backup := &models.BackupData{
		Version:      "",
		Certificates: []*models.BackupCertificate{},
	}

	_, err := svc.ImportBackup(ctx, backup, nil)
	if err == nil {
		t.Fatal("expected error for missing version, got nil")
	}
	if !containsSubstring(err.Error(), "version") {
		t.Errorf("expected version error, got: %v", err)
	}
}

func TestImportBackup_EmptyHostname_ReturnsError(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()

	backup := &models.BackupData{
		Version:    "1.0",
		ExportedAt: time.Now().Unix(),
		Certificates: []*models.BackupCertificate{
			{Hostname: "", CreatedAt: time.Now().Unix()},
		},
	}

	_, err := svc.ImportBackup(ctx, backup, nil)
	if err == nil {
		t.Fatal("expected error for empty hostname, got nil")
	}
	if !containsSubstring(err.Error(), "empty hostname") {
		t.Errorf("expected empty hostname error, got: %v", err)
	}
}

func TestImportBackup_LogsHistoryEvents(t *testing.T) {
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()

	backup := &models.BackupData{
		Version:    "1.0",
		ExportedAt: time.Now().Unix(),
		Certificates: []*models.BackupCertificate{
			{Hostname: "server1.example.com", CreatedAt: time.Now().Unix()},
			{Hostname: "server2.example.com", CreatedAt: time.Now().Unix()},
		},
	}

	_, err := svc.ImportBackup(ctx, backup, nil)
	if err != nil {
		t.Fatalf("ImportBackup failed: %v", err)
	}

	history := NewHistoryService(database)
	entries1, err := history.GetHistory(ctx, "server1.example.com", 10)
	if err != nil {
		t.Fatalf("GetHistory failed: %v", err)
	}
	if len(entries1) != 1 {
		t.Fatalf("expected 1 history entry for server1, got %d", len(entries1))
	}
	if entries1[0].EventType != models.EventCertificateRestored {
		t.Errorf("expected event type %s, got %s", models.EventCertificateRestored, entries1[0].EventType)
	}

	entries2, err := history.GetHistory(ctx, "server2.example.com", 10)
	if err != nil {
		t.Fatalf("GetHistory failed: %v", err)
	}
	if len(entries2) != 1 {
		t.Fatalf("expected 1 history entry for server2, got %d", len(entries2))
	}
}

func TestImportBackup_RoundTrip(t *testing.T) {
	// Since all :memory: DBs share state via cache=shared, we test round-trip
	// by exporting, clearing the DB, then importing back
	svc, database := setupBackupService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	csrPEM, encryptedKey, _ := generateTestCSRAndKey(t, "server.example.com", encryptionKey)

	expiresAt := time.Now().Add(365 * 24 * time.Hour).Unix()
	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:                   "server.example.com",
		EncryptedPrivateKey:        encryptedKey,
		PendingCsrPem:              sql.NullString{String: string(csrPEM), Valid: true},
		PendingEncryptedPrivateKey: encryptedKey,
		CertificatePem:             sql.NullString{String: "cert-pem-data", Valid: true},
		ExpiresAt:                  sql.NullInt64{Int64: expiresAt, Valid: true},
		Note:                       sql.NullString{String: "test note", Valid: true},
		PendingNote:                sql.NullString{String: "pending note", Valid: true},
		ReadOnly:                   1,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	// Export
	backup, err := svc.ExportBackup(ctx, true)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	// Clear DB and re-import
	err = database.Queries().DeleteCertificate(ctx, "server.example.com")
	if err != nil {
		t.Fatalf("failed to delete certificate: %v", err)
	}

	result, err := svc.ImportBackup(ctx, backup, encryptionKey)
	if err != nil {
		t.Fatalf("ImportBackup failed: %v", err)
	}
	if result.Success != 1 {
		t.Errorf("expected 1 import, got %d", result.Success)
	}

	// Verify imported data matches
	cert, err := database.Queries().GetCertificateByHostname(ctx, "server.example.com")
	if err != nil {
		t.Fatalf("failed to get imported certificate: %v", err)
	}

	if cert.Hostname != "server.example.com" {
		t.Errorf("hostname mismatch: %s", cert.Hostname)
	}
	if !cert.CertificatePem.Valid || cert.CertificatePem.String != "cert-pem-data" {
		t.Error("certificate PEM mismatch")
	}
	if !cert.PendingCsrPem.Valid || cert.PendingCsrPem.String != string(csrPEM) {
		t.Error("pending CSR mismatch")
	}
	if !cert.Note.Valid || cert.Note.String != "test note" {
		t.Error("note mismatch")
	}
	if !cert.PendingNote.Valid || cert.PendingNote.String != "pending note" {
		t.Error("pending note mismatch")
	}
	if cert.ReadOnly != 1 {
		t.Error("expected ReadOnly=1")
	}

	// Verify key decryptable
	_, err = crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, encryptionKey)
	if err != nil {
		t.Fatalf("failed to decrypt imported key: %v", err)
	}
}
