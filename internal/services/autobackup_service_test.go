package services

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"paddockcontrol-desktop/internal/db"
)

// setupAutoBackupTest creates a real file-based SQLite database in a temp directory
// and returns an AutoBackupService, the database, and the temp dir path.
func setupAutoBackupTest(t *testing.T) (*AutoBackupService, *db.Database, string) {
	t.Helper()

	tmpDir := t.TempDir()

	database, err := db.NewDatabase(tmpDir)
	if err != nil {
		t.Fatalf("failed to create database: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	svc := NewAutoBackupService(database.DB(), tmpDir)
	return svc, database, tmpDir
}

// seedTestData inserts a config row and N certificate rows into the database.
func seedTestData(t *testing.T, database *db.Database, certCount int) {
	t.Helper()

	_, err := database.DB().Exec(`INSERT INTO config (id, owner_email, ca_name, hostname_suffix, default_organization, default_city, default_state, default_country, default_key_size, validity_period_days, is_configured)
		VALUES (1, 'test@example.com', 'Test CA', '.test.local', 'Test Org', 'Paris', 'IDF', 'FR', 4096, 365, 1)`)
	if err != nil {
		t.Fatalf("failed to seed config: %v", err)
	}

	for i := 0; i < certCount; i++ {
		hostname := fmt.Sprintf("host%d.test.local", i)
		_, err := database.DB().Exec(
			`INSERT INTO certificates (hostname, encrypted_private_key, pending_csr_pem) VALUES (?, ?, ?)`,
			hostname, fmt.Sprintf("encrypted_key_%d", i), fmt.Sprintf("csr_pem_%d", i),
		)
		if err != nil {
			t.Fatalf("failed to seed certificate %d: %v", i, err)
		}
	}
}

// countAutoBackups returns the number of auto-backup files in the directory.
func countAutoBackups(t *testing.T, dir string) int {
	t.Helper()
	matches, err := filepath.Glob(filepath.Join(dir, autoBackupPrefix+"*"))
	if err != nil {
		t.Fatalf("failed to glob auto-backups: %v", err)
	}
	return len(matches)
}

func TestCreateBackup_CreatesFile(t *testing.T) {
	svc, database, tmpDir := setupAutoBackupTest(t)
	seedTestData(t, database, 3)

	path, err := svc.CreateBackup("test_operation")
	if err != nil {
		t.Fatalf("CreateBackup failed: %v", err)
	}

	// Verify file exists
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("backup file does not exist: %v", err)
	}
	if info.Size() == 0 {
		t.Fatal("backup file is empty")
	}

	// Verify file is in the expected directory
	if filepath.Dir(path) != tmpDir {
		t.Errorf("backup not in expected directory: got %s, want %s", filepath.Dir(path), tmpDir)
	}

	// Verify filename matches expected pattern
	base := filepath.Base(path)
	if len(base) < len(autoBackupPrefix) || base[:len(autoBackupPrefix)] != autoBackupPrefix {
		t.Errorf("unexpected backup filename: %s", base)
	}
}

func TestCreateBackup_ProducesValidSQLite(t *testing.T) {
	svc, database, _ := setupAutoBackupTest(t)
	seedTestData(t, database, 3)

	path, err := svc.CreateBackup("test_operation")
	if err != nil {
		t.Fatalf("CreateBackup failed: %v", err)
	}

	// Open the backup as a SQLite database and verify data
	backupDB, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatalf("failed to open backup database: %v", err)
	}
	defer backupDB.Close()

	// Verify certificates were backed up
	var certCount int
	err = backupDB.QueryRow("SELECT COUNT(*) FROM certificates").Scan(&certCount)
	if err != nil {
		t.Fatalf("failed to query backup certificates: %v", err)
	}
	if certCount != 3 {
		t.Errorf("expected 3 certificates in backup, got %d", certCount)
	}

	// Verify config was backed up
	var configCount int
	err = backupDB.QueryRow("SELECT COUNT(*) FROM config").Scan(&configCount)
	if err != nil {
		t.Fatalf("failed to query backup config: %v", err)
	}
	if configCount != 1 {
		t.Errorf("expected 1 config row in backup, got %d", configCount)
	}

	// Verify a specific certificate hostname exists
	var hostname string
	err = backupDB.QueryRow("SELECT hostname FROM certificates WHERE hostname = ?", "host0.test.local").Scan(&hostname)
	if err != nil {
		t.Fatalf("failed to query specific certificate: %v", err)
	}
	if hostname != "host0.test.local" {
		t.Errorf("expected hostname 'host0.test.local', got %q", hostname)
	}
}

func TestCreateBackup_RotatesOldBackups(t *testing.T) {
	svc, database, tmpDir := setupAutoBackupTest(t)
	seedTestData(t, database, 1)

	// Create more backups than maxKeep
	for i := 0; i < DefaultMaxAutoBackups+3; i++ {
		_, err := svc.CreateBackup(fmt.Sprintf("operation_%d", i))
		if err != nil {
			t.Fatalf("CreateBackup %d failed: %v", i, err)
		}
		// Small delay to ensure unique timestamps
		time.Sleep(1100 * time.Millisecond)
	}

	count := countAutoBackups(t, tmpDir)
	if count != DefaultMaxAutoBackups {
		t.Errorf("expected %d backups after rotation, got %d", DefaultMaxAutoBackups, count)
	}
}

func TestCreateBackup_KeepsNewestAfterRotation(t *testing.T) {
	svc, database, tmpDir := setupAutoBackupTest(t)
	seedTestData(t, database, 1)

	var allPaths []string
	for i := 0; i < DefaultMaxAutoBackups+2; i++ {
		path, err := svc.CreateBackup(fmt.Sprintf("operation_%d", i))
		if err != nil {
			t.Fatalf("CreateBackup %d failed: %v", i, err)
		}
		allPaths = append(allPaths, path)
		time.Sleep(1100 * time.Millisecond)
	}

	// The oldest 2 should have been removed
	for _, old := range allPaths[:2] {
		if _, err := os.Stat(old); !os.IsNotExist(err) {
			t.Errorf("expected old backup to be deleted: %s", old)
		}
	}

	// The newest DefaultMaxAutoBackups should still exist
	for _, newer := range allPaths[2:] {
		if _, err := os.Stat(newer); err != nil {
			t.Errorf("expected newer backup to exist: %s (err: %v)", newer, err)
		}
	}

	count := countAutoBackups(t, tmpDir)
	if count != DefaultMaxAutoBackups {
		t.Errorf("expected %d backups, got %d", DefaultMaxAutoBackups, count)
	}
}

func TestCreateBackup_EmptyDatabase(t *testing.T) {
	svc, _, _ := setupAutoBackupTest(t)

	// Should succeed even with no data
	path, err := svc.CreateBackup("test_empty")
	if err != nil {
		t.Fatalf("CreateBackup on empty database failed: %v", err)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("backup file does not exist: %v", err)
	}
	if info.Size() == 0 {
		t.Fatal("backup file is empty even for empty database")
	}
}

func TestCreateBackup_BackupIsIndependentFromSource(t *testing.T) {
	svc, database, _ := setupAutoBackupTest(t)
	seedTestData(t, database, 2)

	path, err := svc.CreateBackup("test_independence")
	if err != nil {
		t.Fatalf("CreateBackup failed: %v", err)
	}

	// Add more data to the source after backup
	_, err = database.DB().Exec(
		`INSERT INTO certificates (hostname, encrypted_private_key) VALUES (?, ?)`,
		"new.test.local", "new_key",
	)
	if err != nil {
		t.Fatalf("failed to insert post-backup certificate: %v", err)
	}

	// Verify backup still has the original count (2, not 3)
	backupDB, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatalf("failed to open backup: %v", err)
	}
	defer backupDB.Close()

	var count int
	err = backupDB.QueryRow("SELECT COUNT(*) FROM certificates").Scan(&count)
	if err != nil {
		t.Fatalf("failed to query backup: %v", err)
	}
	if count != 2 {
		t.Errorf("backup should have 2 certificates (snapshot), got %d", count)
	}
}

func TestCreateBackup_DoesNotAffectExistingFiles(t *testing.T) {
	svc, database, tmpDir := setupAutoBackupTest(t)
	seedTestData(t, database, 1)

	// Create a non-backup file in the same directory
	otherFile := filepath.Join(tmpDir, "other_file.txt")
	if err := os.WriteFile(otherFile, []byte("keep me"), 0600); err != nil {
		t.Fatalf("failed to create other file: %v", err)
	}

	// Create enough backups to trigger rotation
	for i := 0; i < DefaultMaxAutoBackups+2; i++ {
		_, err := svc.CreateBackup(fmt.Sprintf("op_%d", i))
		if err != nil {
			t.Fatalf("CreateBackup %d failed: %v", i, err)
		}
		time.Sleep(1100 * time.Millisecond)
	}

	// Other file should not be touched
	data, err := os.ReadFile(otherFile)
	if err != nil {
		t.Fatalf("other file was deleted: %v", err)
	}
	if string(data) != "keep me" {
		t.Error("other file content was modified")
	}
}
