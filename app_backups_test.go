package main

import (
	"os"
	"path/filepath"
	"testing"
)

// ============================================================================
// PeekLocalBackup
// ============================================================================

// stageLocalBackup creates a backup .db file under the app's backups directory
// and returns its filename.
func stageLocalBackup(t *testing.T, app *App, filename string, opts testBackupDBOpts) string {
	t.Helper()

	srcPath, _ := createTestBackupDB(t, opts)

	backupsDir := filepath.Join(app.dataDir, "backups")
	if err := os.MkdirAll(backupsDir, 0o755); err != nil {
		t.Fatalf("failed to create backups dir: %v", err)
	}
	if err := copyFile(srcPath, filepath.Join(backupsDir, filename)); err != nil {
		t.Fatalf("failed to stage backup: %v", err)
	}
	return filename
}

func TestPeekLocalBackup_ManualBackup(t *testing.T) {
	app, _ := setupFileBasedApp(t)

	filename := stageLocalBackup(t, app, "certificates.db.backup.manual.20260615-120000.db", testBackupDBOpts{
		hostnames: []string{"alpha.example.com", "bravo.example.com"},
		password:  testPassword,
		caName:    "My CA",
	})

	info, err := app.PeekLocalBackup(filename)
	if err != nil {
		t.Fatalf("PeekLocalBackup() error: %v", err)
	}

	if info.CertificateCount != 2 {
		t.Fatalf("expected 2 certificates, got %d", info.CertificateCount)
	}
	if info.CAName != "My CA" {
		t.Fatalf("expected CA name 'My CA', got %q", info.CAName)
	}
	if !info.HasSecurityKeys {
		t.Fatal("expected has_security_keys=true")
	}
	if info.SchemaVersion != 4 {
		t.Fatalf("expected schema_version=4, got %d", info.SchemaVersion)
	}

	// Per-certificate details should be populated for the drawer.
	if len(info.Certificates) != 2 {
		t.Fatalf("expected 2 certificate entries, got %d", len(info.Certificates))
	}
	for _, c := range info.Certificates {
		if c.Hostname == "" {
			t.Fatal("certificate entry missing hostname")
		}
		if c.CreatedAt == 0 {
			t.Fatalf("certificate %q missing created_at", c.Hostname)
		}
		// Test backups insert certs without a signed PEM/CSR → pending.
		if c.Status != "pending" {
			t.Fatalf("certificate %q: expected status pending, got %q", c.Hostname, c.Status)
		}
	}
}

func TestPeekLocalBackup_AutoBackup(t *testing.T) {
	app, _ := setupFileBasedApp(t)

	filename := stageLocalBackup(t, app, "certificates.db.autobackup.20260615-120000.db", testBackupDBOpts{
		certCount: 1,
	})

	info, err := app.PeekLocalBackup(filename)
	if err != nil {
		t.Fatalf("PeekLocalBackup() error: %v", err)
	}
	if info.CertificateCount != 1 {
		t.Fatalf("expected 1 certificate, got %d", info.CertificateCount)
	}
}

func TestPeekLocalBackup_RejectsInvalidFilenames(t *testing.T) {
	app, _ := setupFileBasedApp(t)

	cases := []string{
		"../certificates.db",                       // path traversal
		"backups/certificates.db.backup.manual.db", // contains separator
		"certificates.db",                          // not a backup prefix
		"random-file.db",                           // unrelated file
	}

	for _, name := range cases {
		if _, err := app.PeekLocalBackup(name); err == nil {
			t.Fatalf("expected error for invalid filename %q, got nil", name)
		}
	}
}

func TestPeekLocalBackup_MissingFile(t *testing.T) {
	app, _ := setupFileBasedApp(t)

	// Valid prefix, but the file does not exist on disk.
	_, err := app.PeekLocalBackup("certificates.db.backup.manual.20260615-120000.db")
	if err == nil {
		t.Fatal("expected error for non-existent backup file")
	}
}
