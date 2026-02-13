package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"testing"

	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
	"paddockcontrol-desktop/internal/testutil"
)

// ============================================================================
// Test helpers
// ============================================================================

// testBackupDBOpts configures a test backup database.
type testBackupDBOpts struct {
	certCount     int      // number of test certs to insert (auto-generated hostnames)
	hostnames     []string // explicit hostnames (overrides certCount)
	password      string   // password to create security_keys entry (empty = no security keys)
	masterKey     []byte   // master key to encrypt certs with (generated if nil + password set)
	schemaVersion int      // 0 = leave at current, >0 = override schema_migrations version
	dirty         bool     // set dirty flag in schema_migrations
	caName        string   // CA name in config (empty = "Test CA")
}

// fastArgon2Params returns fast Argon2id params suitable for testing.
var fastArgon2Params = crypto.Argon2idParams{
	Memory:      64 * 1024,
	Iterations:  1,
	Parallelism: 1,
	KeyLength:   32,
	SaltLength:  16,
}

// createTestBackupDB creates a real SQLite .db file with controlled content for testing.
// Returns the path to the backup file and the master key used to encrypt certificates.
func createTestBackupDB(t *testing.T, opts testBackupDBOpts) (string, []byte) {
	t.Helper()

	tmpDir := t.TempDir()
	database, err := db.NewDatabase(tmpDir)
	if err != nil {
		t.Fatalf("failed to create backup database: %v", err)
	}

	ctx := context.Background()
	queries := database.Queries()

	// Seed config
	caName := "Test CA"
	if opts.caName != "" {
		caName = opts.caName
	}
	err = queries.CreateConfig(ctx, sqlc.CreateConfigParams{
		OwnerEmail:          "backup@example.com",
		CaName:              caName,
		HostnameSuffix:      ".example.com",
		DefaultOrganization: "Backup Org",
		DefaultCity:         "Paris",
		DefaultState:        "IDF",
		DefaultCountry:      "FR",
		DefaultKeySize:      2048,
		ValidityPeriodDays:  365,
	})
	if err != nil {
		t.Fatalf("failed to create config: %v", err)
	}
	if err := queries.SetConfigured(ctx); err != nil {
		t.Fatalf("failed to set configured: %v", err)
	}

	// Determine hostnames
	hostnames := opts.hostnames
	if len(hostnames) == 0 {
		for i := 0; i < opts.certCount; i++ {
			hostnames = append(hostnames, fmt.Sprintf("host%d.example.com", i))
		}
	}

	// Determine master key
	masterKey := opts.masterKey
	if masterKey == nil && opts.password != "" {
		masterKey = testutil.RandomMasterKey(t)
	}

	// Insert certificates
	for _, hostname := range hostnames {
		params := sqlc.CreateCertificateParams{
			Hostname: hostname,
		}

		// Encrypt private key if we have a master key
		if masterKey != nil {
			key, err := crypto.GenerateRSAKey(2048)
			if err != nil {
				t.Fatalf("failed to generate RSA key: %v", err)
			}
			keyPEM, err := crypto.PrivateKeyToPEM(key)
			if err != nil {
				t.Fatalf("failed to convert key to PEM: %v", err)
			}
			encrypted, err := crypto.EncryptPrivateKey(keyPEM, masterKey)
			if err != nil {
				t.Fatalf("failed to encrypt private key: %v", err)
			}
			params.EncryptedPrivateKey = encrypted
		}

		if err := queries.CreateCertificate(ctx, params); err != nil {
			t.Fatalf("failed to create certificate %s: %v", hostname, err)
		}
	}

	// Create security_keys entry if password is provided
	if opts.password != "" {
		salt, err := crypto.GenerateSalt(fastArgon2Params.SaltLength)
		if err != nil {
			t.Fatalf("failed to generate salt: %v", err)
		}

		wrappingKey := crypto.DeriveKeyFromPassword(opts.password, salt, fastArgon2Params)
		wrappedMasterKey, err := crypto.WrapMasterKey(masterKey, wrappingKey)
		if err != nil {
			t.Fatalf("failed to wrap master key: %v", err)
		}

		metadata := models.PasswordMetadata{
			Salt:              salt,
			Argon2Memory:      fastArgon2Params.Memory,
			Argon2Iterations:  fastArgon2Params.Iterations,
			Argon2Parallelism: fastArgon2Params.Parallelism,
		}
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			t.Fatalf("failed to marshal metadata: %v", err)
		}

		_, err = database.DB().ExecContext(ctx,
			`INSERT INTO security_keys (method, label, wrapped_master_key, metadata) VALUES (?, ?, ?, ?)`,
			models.SecurityKeyMethodPassword, "Test Password", wrappedMasterKey, string(metadataJSON),
		)
		if err != nil {
			t.Fatalf("failed to insert security key: %v", err)
		}
	}

	// Override schema version if requested
	if opts.schemaVersion > 0 {
		_, err := database.DB().Exec("UPDATE schema_migrations SET version = ?", opts.schemaVersion)
		if err != nil {
			t.Fatalf("failed to override schema version: %v", err)
		}
		// Drop security_keys for pre-v4 simulation
		if opts.schemaVersion < 4 {
			database.DB().Exec("DROP TABLE IF EXISTS security_keys")
		}
	}

	// Set dirty flag if requested
	if opts.dirty {
		_, err := database.DB().Exec("UPDATE schema_migrations SET dirty = 1")
		if err != nil {
			t.Fatalf("failed to set dirty flag: %v", err)
		}
	}

	database.Close()

	return filepath.Join(tmpDir, "certificates.db"), masterKey
}

// setupFileBasedApp creates a configured, unlocked App with a file-based database.
// Needed for RestoreFromBackupFile tests which do file operations.
func setupFileBasedApp(t *testing.T) (*App, string) {
	t.Helper()

	tmpDir := t.TempDir()
	database, err := db.NewDatabase(tmpDir)
	if err != nil {
		t.Fatalf("failed to create database: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	app := &App{
		ctx:     context.Background(),
		db:      database,
		dataDir: tmpDir,
	}
	app.initializeServicesWithoutKey()

	// Configure
	err = app.db.Queries().CreateConfig(app.ctx, sqlc.CreateConfigParams{
		OwnerEmail:          "test@example.com",
		CaName:              "Test CA",
		HostnameSuffix:      ".example.com",
		DefaultOrganization: "Test Org",
		DefaultCity:         "Test City",
		DefaultState:        "Test State",
		DefaultCountry:      "FR",
		DefaultKeySize:      2048,
		ValidityPeriodDays:  365,
	})
	if err != nil {
		t.Fatalf("failed to create config: %v", err)
	}
	if err := app.db.Queries().SetConfigured(app.ctx); err != nil {
		t.Fatalf("failed to set configured: %v", err)
	}
	app.isConfigured = true

	// Unlock
	result, err := app.ProvideEncryptionKey(testPassword)
	if err != nil {
		t.Fatalf("failed to unlock: %v", err)
	}
	if !result.Valid {
		t.Fatal("expected valid key validation")
	}

	return app, tmpDir
}

// ============================================================================
// getBackupSchemaVersion
// ============================================================================

func TestGetBackupSchemaVersion_V4(t *testing.T) {
	backupPath, _ := createTestBackupDB(t, testBackupDBOpts{})

	backupDB, err := sql.Open("sqlite", backupPath+"?mode=ro")
	if err != nil {
		t.Fatalf("failed to open backup: %v", err)
	}
	defer backupDB.Close()

	version, dirty := getBackupSchemaVersion(backupDB)
	if version != 4 {
		t.Fatalf("expected schema version 4, got %d", version)
	}
	if dirty {
		t.Fatal("expected dirty=false")
	}
}

func TestGetBackupSchemaVersion_NoTable(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "bare.db")

	bareDB, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to create bare db: %v", err)
	}
	bareDB.Exec("CREATE TABLE certificates (hostname TEXT PRIMARY KEY)")
	defer bareDB.Close()

	version, dirty := getBackupSchemaVersion(bareDB)
	if version != 0 {
		t.Fatalf("expected version 0 for missing schema_migrations, got %d", version)
	}
	if dirty {
		t.Fatal("expected dirty=false")
	}
}

// ============================================================================
// PeekBackupInfo
// ============================================================================

func TestPeekBackupInfo_V4Backup(t *testing.T) {
	backupPath, _ := createTestBackupDB(t, testBackupDBOpts{
		hostnames: []string{"alpha.example.com", "bravo.example.com", "charlie.example.com"},
		password:  testPassword,
		caName:    "My CA",
	})

	app := setupTestApp(t)
	info, err := app.PeekBackupInfo(backupPath)
	if err != nil {
		t.Fatalf("PeekBackupInfo() error: %v", err)
	}

	if info.CertificateCount != 3 {
		t.Fatalf("expected 3 certificates, got %d", info.CertificateCount)
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

	// Hostnames should be sorted
	expected := []string{"alpha.example.com", "bravo.example.com", "charlie.example.com"}
	if len(info.Hostnames) != len(expected) {
		t.Fatalf("expected %d hostnames, got %d", len(expected), len(info.Hostnames))
	}
	for i, h := range expected {
		if info.Hostnames[i] != h {
			t.Fatalf("hostname[%d]: expected %q, got %q", i, h, info.Hostnames[i])
		}
	}
}

func TestPeekBackupInfo_PreV4Backup(t *testing.T) {
	backupPath, _ := createTestBackupDB(t, testBackupDBOpts{
		certCount:     2,
		schemaVersion: 3,
	})

	app := setupTestApp(t)
	info, err := app.PeekBackupInfo(backupPath)
	if err != nil {
		t.Fatalf("PeekBackupInfo() error: %v", err)
	}

	if info.SchemaVersion != 3 {
		t.Fatalf("expected schema_version=3, got %d", info.SchemaVersion)
	}
	if info.HasSecurityKeys {
		t.Fatal("expected has_security_keys=false for pre-v4 backup")
	}
	if info.CertificateCount != 2 {
		t.Fatalf("expected 2 certificates, got %d", info.CertificateCount)
	}
}

func TestPeekBackupInfo_EmptyBackup(t *testing.T) {
	backupPath, _ := createTestBackupDB(t, testBackupDBOpts{
		certCount: 0,
		password:  testPassword,
	})

	app := setupTestApp(t)
	info, err := app.PeekBackupInfo(backupPath)
	if err != nil {
		t.Fatalf("PeekBackupInfo() error: %v", err)
	}

	if info.CertificateCount != 0 {
		t.Fatalf("expected 0 certificates, got %d", info.CertificateCount)
	}
	if info.Hostnames == nil {
		t.Fatal("expected non-nil hostnames slice")
	}
	if len(info.Hostnames) != 0 {
		t.Fatalf("expected empty hostnames, got %d", len(info.Hostnames))
	}
	if info.SchemaVersion != 4 {
		t.Fatalf("expected schema_version=4, got %d", info.SchemaVersion)
	}
}

func TestPeekBackupInfo_InvalidPath(t *testing.T) {
	app := setupTestApp(t)

	_, err := app.PeekBackupInfo("/nonexistent/backup.db")
	if err == nil {
		t.Fatal("expected error for non-existent file")
	}
}

// ============================================================================
// ImportCertificatesFromBackup
// ============================================================================

func TestImportCertificates_Success(t *testing.T) {
	backupPath, _ := createTestBackupDB(t, testBackupDBOpts{
		hostnames: []string{"import1.example.com", "import2.example.com", "import3.example.com"},
		password:  testPassword,
	})

	app := setupUnlockedApp(t)

	result, err := app.ImportCertificatesFromBackup(backupPath, testPassword)
	if err != nil {
		t.Fatalf("ImportCertificatesFromBackup() error: %v", err)
	}

	if result.Imported != 3 {
		t.Fatalf("expected 3 imported, got %d", result.Imported)
	}
	if result.Skipped != 0 {
		t.Fatalf("expected 0 skipped, got %d", result.Skipped)
	}
	if len(result.Conflicts) != 0 {
		t.Fatalf("expected 0 conflicts, got %d", len(result.Conflicts))
	}

	// Verify certs exist in destination
	for _, hostname := range []string{"import1.example.com", "import2.example.com", "import3.example.com"} {
		exists, err := app.db.Queries().CertificateExists(app.ctx, hostname)
		if err != nil {
			t.Fatalf("CertificateExists(%s) error: %v", hostname, err)
		}
		if exists != 1 {
			t.Fatalf("expected certificate %s to exist", hostname)
		}
	}
}

func TestImportCertificates_ReEncryptsKeys(t *testing.T) {
	backupPath, backupMasterKey := createTestBackupDB(t, testBackupDBOpts{
		hostnames: []string{"reencrypt.example.com"},
		password:  testPassword,
	})

	app := setupUnlockedApp(t)

	_, err := app.ImportCertificatesFromBackup(backupPath, testPassword)
	if err != nil {
		t.Fatalf("ImportCertificatesFromBackup() error: %v", err)
	}

	// Get the imported cert
	cert, err := app.db.Queries().GetCertificateByHostname(app.ctx, "reencrypt.example.com")
	if err != nil {
		t.Fatalf("GetCertificateByHostname() error: %v", err)
	}

	// Should be decryptable with the destination's master key
	_, err = crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, app.masterKey)
	if err != nil {
		t.Fatalf("failed to decrypt with destination master key: %v", err)
	}

	// Should NOT be decryptable with the backup's master key
	_, err = crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, backupMasterKey)
	if err == nil {
		t.Fatal("should not be decryptable with backup master key after re-encryption")
	}
}

func TestImportCertificates_WrongPassword(t *testing.T) {
	backupPath, _ := createTestBackupDB(t, testBackupDBOpts{
		hostnames: []string{"wrongpw.example.com"},
		password:  testPassword,
	})

	app := setupUnlockedApp(t)

	_, err := app.ImportCertificatesFromBackup(backupPath, "wrong-password-at-least-16")
	if err == nil {
		t.Fatal("expected error for wrong password")
	}
	if !strings.Contains(err.Error(), "wrong password") {
		t.Fatalf("expected error to mention 'wrong password', got: %v", err)
	}
}

func TestImportCertificates_ConflictSkip(t *testing.T) {
	backupPath, _ := createTestBackupDB(t, testBackupDBOpts{
		hostnames: []string{"existing.example.com", "new1.example.com", "new2.example.com"},
		password:  testPassword,
	})

	app := setupUnlockedApp(t)

	// Insert a cert with the same hostname as one in the backup
	err := app.db.Queries().CreateCertificate(app.ctx, sqlc.CreateCertificateParams{
		Hostname: "existing.example.com",
	})
	if err != nil {
		t.Fatalf("failed to create conflicting cert: %v", err)
	}

	result, err := app.ImportCertificatesFromBackup(backupPath, testPassword)
	if err != nil {
		t.Fatalf("ImportCertificatesFromBackup() error: %v", err)
	}

	if result.Imported != 2 {
		t.Fatalf("expected 2 imported, got %d", result.Imported)
	}
	if result.Skipped != 1 {
		t.Fatalf("expected 1 skipped, got %d", result.Skipped)
	}
	if len(result.Conflicts) != 1 || result.Conflicts[0] != "existing.example.com" {
		t.Fatalf("expected conflict for 'existing.example.com', got %v", result.Conflicts)
	}
}

func TestImportCertificates_PreV4Backup(t *testing.T) {
	backupPath, _ := createTestBackupDB(t, testBackupDBOpts{
		certCount:     1,
		schemaVersion: 3,
	})

	app := setupUnlockedApp(t)

	_, err := app.ImportCertificatesFromBackup(backupPath, testPassword)
	if err == nil {
		t.Fatal("expected error for pre-v4 backup")
	}
	if !strings.Contains(err.Error(), "older version") {
		t.Fatalf("expected error to mention 'older version', got: %v", err)
	}
	if !strings.Contains(err.Error(), "schema v3") {
		t.Fatalf("expected error to mention 'schema v3', got: %v", err)
	}
}

func TestImportCertificates_DirtyMigration(t *testing.T) {
	backupPath, _ := createTestBackupDB(t, testBackupDBOpts{
		certCount: 1,
		password:  testPassword,
		dirty:     true,
	})

	app := setupUnlockedApp(t)

	_, err := app.ImportCertificatesFromBackup(backupPath, testPassword)
	if err == nil {
		t.Fatal("expected error for dirty migration")
	}
	if !strings.Contains(err.Error(), "dirty") {
		t.Fatalf("expected error to mention 'dirty', got: %v", err)
	}
}

func TestImportCertificates_RequiresUnlock(t *testing.T) {
	backupPath, _ := createTestBackupDB(t, testBackupDBOpts{
		certCount: 1,
		password:  testPassword,
	})

	app := setupConfiguredApp(t) // configured but locked

	_, err := app.ImportCertificatesFromBackup(backupPath, testPassword)
	if err == nil {
		t.Fatal("expected error when app is locked")
	}
}

// ============================================================================
// RestoreFromBackupFile
// ============================================================================

func TestRestoreFromBackupFile_Success(t *testing.T) {
	// Create a backup with known certs
	backupPath, _ := createTestBackupDB(t, testBackupDBOpts{
		hostnames: []string{"restored1.example.com", "restored2.example.com"},
		password:  "backup-password-16-chars",
		caName:    "Backup CA",
	})

	app, _ := setupFileBasedApp(t)

	// Verify app starts unlocked with no certs from the backup
	if !app.isUnlocked {
		t.Fatal("app should start unlocked")
	}

	err := app.RestoreFromBackupFile(backupPath)
	if err != nil {
		t.Fatalf("RestoreFromBackupFile() error: %v", err)
	}

	// App should be locked after restore
	if app.isUnlocked {
		t.Fatal("app should be locked after restore")
	}
	if app.masterKey != nil {
		t.Fatal("master key should be nil after restore")
	}

	// Database should contain the backup's certs
	certs, err := app.db.Queries().ListAllCertificates(app.ctx)
	if err != nil {
		t.Fatalf("ListAllCertificates() error: %v", err)
	}

	hostnames := make(map[string]bool)
	for _, c := range certs {
		hostnames[c.Hostname] = true
	}
	if !hostnames["restored1.example.com"] || !hostnames["restored2.example.com"] {
		t.Fatalf("expected backup certs, got hostnames: %v", hostnames)
	}
}

func TestRestoreFromBackupFile_DirtyMigration(t *testing.T) {
	backupPath, _ := createTestBackupDB(t, testBackupDBOpts{
		certCount: 1,
		password:  testPassword,
		dirty:     true,
	})

	app, _ := setupFileBasedApp(t)

	// Insert a cert so we can verify DB is untouched after failure
	err := app.db.Queries().CreateCertificate(app.ctx, sqlc.CreateCertificateParams{
		Hostname: "original.example.com",
	})
	if err != nil {
		t.Fatalf("failed to create original cert: %v", err)
	}

	err = app.RestoreFromBackupFile(backupPath)
	if err == nil {
		t.Fatal("expected error for dirty migration")
	}
	if !strings.Contains(err.Error(), "dirty") {
		t.Fatalf("expected error to mention 'dirty', got: %v", err)
	}

	// Original DB should be untouched
	exists, err := app.db.Queries().CertificateExists(app.ctx, "original.example.com")
	if err != nil {
		t.Fatalf("CertificateExists() error: %v", err)
	}
	if exists != 1 {
		t.Fatal("original cert should still exist after failed restore")
	}
}

func TestRestoreFromBackupFile_InvalidPath(t *testing.T) {
	app, _ := setupFileBasedApp(t)

	err := app.RestoreFromBackupFile("/nonexistent/backup.db")
	if err == nil {
		t.Fatal("expected error for non-existent file")
	}
}
