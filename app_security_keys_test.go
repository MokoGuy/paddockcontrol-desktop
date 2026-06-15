package main

import (
	"testing"

	gokeyring "github.com/zalando/go-keyring"

	"paddockcontrol-desktop/internal/keystore"
	"paddockcontrol-desktop/internal/models"
)

func passwordKeyID(t *testing.T, app *App) int64 {
	t.Helper()
	rows, err := app.db.Queries().GetSecurityKeysByMethod(app.ctx, models.SecurityKeyMethodPassword)
	if err != nil {
		t.Fatalf("GetSecurityKeysByMethod(password): %v", err)
	}
	if len(rows) == 0 {
		t.Fatal("expected a password security key after setup")
	}
	return rows[0].ID
}

func osNativeCount(t *testing.T, app *App) int {
	t.Helper()
	rows, err := app.db.Queries().GetSecurityKeysByMethod(app.ctx, models.SecurityKeyMethodOSNative)
	if err != nil {
		t.Fatalf("GetSecurityKeysByMethod(os_native): %v", err)
	}
	return len(rows)
}

func TestRemoveSecurityKey_PasswordIsUnremovable(t *testing.T) {
	app := setupUnlockedApp(t)
	id := passwordKeyID(t, app)

	if err := app.RemoveSecurityKey(id); err == nil {
		t.Fatal("expected the password method to be unremovable")
	}
	if _, err := app.db.Queries().GetSecurityKeyByID(app.ctx, id); err != nil {
		t.Fatalf("password key should still exist after a refused removal: %v", err)
	}
}

func TestEnrollOSNative_LifecycleAndSingleSlot(t *testing.T) {
	gokeyring.MockInit()
	app := setupUnlockedApp(t)
	ks := keystore.New()

	if err := app.EnrollOSNative(); err != nil {
		t.Fatalf("EnrollOSNative: %v", err)
	}
	if osNativeCount(t, app) != 1 {
		t.Fatalf("expected 1 os_native row, got %d", osNativeCount(t, app))
	}
	if _, err := ks.Retrieve(keystore.ServiceName, keystore.AccountMasterKey); err != nil {
		t.Fatalf("expected a keyring entry after enroll: %v", err)
	}

	// Single-slot: a second enrollment must be rejected, not silently overwrite.
	if err := app.EnrollOSNative(); err == nil {
		t.Fatal("expected a second EnrollOSNative to be rejected")
	}

	// Remove → both the DB row and the keyring entry go away.
	rows, _ := app.db.Queries().GetSecurityKeysByMethod(app.ctx, models.SecurityKeyMethodOSNative)
	if err := app.RemoveSecurityKey(rows[0].ID); err != nil {
		t.Fatalf("RemoveSecurityKey: %v", err)
	}
	if osNativeCount(t, app) != 0 {
		t.Fatal("expected the os_native row to be removed")
	}
	if _, err := ks.Retrieve(keystore.ServiceName, keystore.AccountMasterKey); err == nil {
		t.Fatal("expected the keyring entry to be deleted")
	}
}

func TestReconcile_RemovesOrphanedDBRow(t *testing.T) {
	gokeyring.MockInit()
	app := setupUnlockedApp(t)
	if err := app.EnrollOSNative(); err != nil {
		t.Fatalf("EnrollOSNative: %v", err)
	}

	// Simulate a partial state / crash: the keyring entry vanished.
	_ = keystore.New().Delete(keystore.ServiceName, keystore.AccountMasterKey)

	app.reconcileSecurityKeys()
	if osNativeCount(t, app) != 0 {
		t.Fatal("reconcile should remove an os_native row whose keyring entry is gone")
	}
}

func TestReconcile_RemovesOrphanedKeyringEntry(t *testing.T) {
	gokeyring.MockInit()
	app := setupUnlockedApp(t)
	ks := keystore.New()

	// Keyring entry with no backing DB row.
	if err := ks.Store(keystore.ServiceName, keystore.AccountMasterKey, []byte("orphan-wrapping-key")); err != nil {
		t.Fatalf("store: %v", err)
	}

	app.reconcileSecurityKeys()
	if _, err := ks.Retrieve(keystore.ServiceName, keystore.AccountMasterKey); err == nil {
		t.Fatal("reconcile should delete an orphaned keyring entry")
	}
}
