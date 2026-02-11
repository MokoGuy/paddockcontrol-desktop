package db

import (
	"testing"
)

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
