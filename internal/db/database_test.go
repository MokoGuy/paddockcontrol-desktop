package db

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"paddockcontrol-desktop/internal/db/sqlc"
)

func TestConnectionPragmas(t *testing.T) {
	// File-based DB so journal_mode(WAL) applies (it doesn't to :memory:).
	database, err := NewDatabase(t.TempDir())
	if err != nil {
		t.Fatalf("NewDatabase: %v", err)
	}
	defer database.Close()

	checks := map[string]string{
		"journal_mode": "wal",
		"foreign_keys": "1",
		"busy_timeout": "5000",
	}
	for pragma, want := range checks {
		var got string
		if err := database.DB().QueryRow("PRAGMA " + pragma).Scan(&got); err != nil {
			t.Fatalf("PRAGMA %s: %v", pragma, err)
		}
		if got != want {
			t.Errorf("PRAGMA %s = %q, want %q", pragma, got, want)
		}
	}
}

func TestForeignKeyCascade(t *testing.T) {
	database, err := NewDatabase(":memory:")
	if err != nil {
		t.Fatalf("NewDatabase: %v", err)
	}
	defer database.Close()
	ctx := context.Background()
	q := database.Queries()

	if err := q.CreateCertificate(ctx, sqlc.CreateCertificateParams{Hostname: "h.test.local"}); err != nil {
		t.Fatalf("CreateCertificate: %v", err)
	}
	if err := q.AddHistoryEntry(ctx, sqlc.AddHistoryEntryParams{Hostname: "h.test.local", EventType: "x", Message: "m"}); err != nil {
		t.Fatalf("AddHistoryEntry: %v", err)
	}

	var hist int
	_ = database.DB().QueryRow("SELECT COUNT(*) FROM certificate_history WHERE hostname='h.test.local'").Scan(&hist)
	if hist != 1 {
		t.Fatalf("expected 1 history row before delete, got %d", hist)
	}

	if err := q.DeleteCertificate(ctx, "h.test.local"); err != nil {
		t.Fatalf("DeleteCertificate: %v", err)
	}

	_ = database.DB().QueryRow("SELECT COUNT(*) FROM certificate_history WHERE hostname='h.test.local'").Scan(&hist)
	if hist != 0 {
		t.Fatalf("ON DELETE CASCADE not enforced: %d orphan history rows remain", hist)
	}
}

func TestWithTx_CommitsOnSuccess(t *testing.T) {
	database, _ := newMemDB(t)
	err := database.WithTx(context.Background(), func(q *sqlc.Queries) error {
		return q.CreateCertificate(context.Background(), sqlc.CreateCertificateParams{Hostname: "ok.test.local"})
	})
	if err != nil {
		t.Fatalf("WithTx: %v", err)
	}
	if !certExists(t, database, "ok.test.local") {
		t.Fatal("committed certificate not found")
	}
}

func TestWithTx_RollsBackOnError(t *testing.T) {
	database, _ := newMemDB(t)
	sentinel := errors.New("boom")
	err := database.WithTx(context.Background(), func(q *sqlc.Queries) error {
		if e := q.CreateCertificate(context.Background(), sqlc.CreateCertificateParams{Hostname: "bad.test.local"}); e != nil {
			return e
		}
		return sentinel // force rollback after a successful write
	})
	if !errors.Is(err, sentinel) {
		t.Fatalf("expected sentinel error, got %v", err)
	}
	if certExists(t, database, "bad.test.local") {
		t.Fatal("write was not rolled back")
	}
}

func TestWithTx_RollsBackOnPanic(t *testing.T) {
	database, _ := newMemDB(t)
	defer func() {
		if recover() == nil {
			t.Fatal("expected panic to propagate")
		}
		if certExists(t, database, "panic.test.local") {
			t.Fatal("write was not rolled back on panic")
		}
	}()
	_ = database.WithTx(context.Background(), func(q *sqlc.Queries) error {
		_ = q.CreateCertificate(context.Background(), sqlc.CreateCertificateParams{Hostname: "panic.test.local"})
		panic("boom")
	})
}

func newMemDB(t *testing.T) (*Database, string) {
	t.Helper()
	database, err := NewDatabase(":memory:")
	if err != nil {
		t.Fatalf("NewDatabase: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return database, filepath.Join(t.TempDir(), "x")
}

func certExists(t *testing.T, d *Database, hostname string) bool {
	t.Helper()
	n, err := d.Queries().CertificateExists(context.Background(), hostname)
	if err != nil {
		t.Fatalf("CertificateExists: %v", err)
	}
	return n == 1
}

func TestResetWithMigrations(t *testing.T) {
	// Create in-memory database
	db, err := NewDatabase(":memory:")
	if err != nil {
		t.Fatalf("Failed to create database: %v", err)
	}
	defer db.Close()

	// Insert some test data
	_, err = db.DB().Exec(`INSERT INTO config (id, owner_email, ca_name, hostname_suffix, default_organization, default_city, default_state, default_country, default_key_size, validity_period_days, is_configured)
		VALUES (1, 'test@example.com', 'Test CA', '.test.local', 'Test Org', 'Paris', 'IDF', 'FR', 4096, 365, 1)`)
	if err != nil {
		t.Fatalf("Failed to insert config: %v", err)
	}

	_, err = db.DB().Exec(`INSERT INTO certificates (hostname, encrypted_private_key, pending_csr_pem)
		VALUES ('test.test.local', 'encrypted_key', 'csr_pem')`)
	if err != nil {
		t.Fatalf("Failed to insert certificate: %v", err)
	}

	// Verify data exists
	var count int
	err = db.DB().QueryRow("SELECT COUNT(*) FROM config").Scan(&count)
	if err != nil || count != 1 {
		t.Fatalf("Expected 1 config row, got %d (err: %v)", count, err)
	}

	err = db.DB().QueryRow("SELECT COUNT(*) FROM certificates").Scan(&count)
	if err != nil || count != 1 {
		t.Fatalf("Expected 1 certificate row, got %d (err: %v)", count, err)
	}

	// Reset using migrations
	err = db.ResetWithMigrations()
	if err != nil {
		t.Fatalf("ResetWithMigrations failed: %v", err)
	}

	// Verify tables are empty
	err = db.DB().QueryRow("SELECT COUNT(*) FROM config").Scan(&count)
	if err != nil || count != 0 {
		t.Fatalf("Expected 0 config rows after reset, got %d (err: %v)", count, err)
	}

	err = db.DB().QueryRow("SELECT COUNT(*) FROM certificates").Scan(&count)
	if err != nil || count != 0 {
		t.Fatalf("Expected 0 certificate rows after reset, got %d (err: %v)", count, err)
	}

	// Verify tables still exist (migrations ran up)
	_, err = db.DB().Exec("SELECT 1 FROM config LIMIT 1")
	if err != nil {
		t.Fatalf("Config table should exist after reset: %v", err)
	}

	_, err = db.DB().Exec("SELECT 1 FROM certificates LIMIT 1")
	if err != nil {
		t.Fatalf("Certificates table should exist after reset: %v", err)
	}
}
