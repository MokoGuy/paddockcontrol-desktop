package main

import (
	"context"
	"database/sql"
	"testing"

	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
)

const testPassword = "test-password-at-least-16-chars"

// setupTestApp creates a minimal App with an in-memory database for testing.
// The app is NOT configured and NOT unlocked.
func setupTestApp(t *testing.T) *App {
	t.Helper()
	database, err := db.NewDatabase(":memory:")
	if err != nil {
		t.Fatalf("failed to create database: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	app := &App{
		ctx:     context.Background(),
		db:      database,
		dataDir: ":memory:",
	}
	app.initializeServicesWithoutKey()
	return app
}

// setupConfiguredApp creates a configured (but locked) App.
func setupConfiguredApp(t *testing.T) *App {
	t.Helper()
	app := setupTestApp(t)

	err := app.db.Queries().CreateConfig(app.ctx, sqlc.CreateConfigParams{
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
	if err := app.db.Queries().SetConfigured(app.ctx); err != nil {
		t.Fatalf("failed to set configured: %v", err)
	}

	app.isConfigured = true
	return app
}

// setupUnlockedApp creates a configured, unlocked App with a password enrolled.
func setupUnlockedApp(t *testing.T) *App {
	t.Helper()
	app := setupConfiguredApp(t)

	result, err := app.ProvideEncryptionKey(testPassword)
	if err != nil {
		t.Fatalf("failed to provide encryption key: %v", err)
	}
	if !result.Valid {
		t.Fatal("expected valid key validation result")
	}

	return app
}

// insertLegacyCert inserts a certificate with a legacy SHA-256 encrypted key.
func insertLegacyCert(t *testing.T, app *App, hostname, password string) {
	t.Helper()

	key, err := crypto.GenerateRSAKey(2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	keyPEM, err := crypto.PrivateKeyToPEM(key)
	if err != nil {
		t.Fatalf("failed to convert key to PEM: %v", err)
	}

	encryptedKey, err := crypto.EncryptPrivateKeyLegacy(keyPEM, password)
	if err != nil {
		t.Fatalf("failed to encrypt key with legacy format: %v", err)
	}

	err = app.db.Queries().CreateCertificate(app.ctx, sqlc.CreateCertificateParams{
		Hostname:            hostname,
		EncryptedPrivateKey: encryptedKey,
	})
	if err != nil {
		t.Fatalf("failed to insert certificate: %v", err)
	}
}

// countSecurityKeys returns the number of security keys in the database.
func countSecurityKeys(t *testing.T, app *App) int64 {
	t.Helper()
	count, err := app.db.Queries().CountAllSecurityKeys(app.ctx)
	if err != nil {
		t.Fatalf("failed to count security keys: %v", err)
	}
	return count
}

// countPasswordKeys returns the number of password-method security keys.
func countPasswordKeys(t *testing.T, app *App) int64 {
	t.Helper()
	count, err := app.db.Queries().CountSecurityKeysByMethod(app.ctx, models.SecurityKeyMethodPassword)
	if err != nil {
		t.Fatalf("failed to count password keys: %v", err)
	}
	return count
}
