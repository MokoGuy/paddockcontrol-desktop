package main

import (
	"context"
	"testing"

	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
)

// ============================================================================
// Path 1: Migration from legacy SHA-256 format
// ============================================================================

func TestProvideEncryptionKey_Migration_ValidPassword(t *testing.T) {
	app := setupConfiguredApp(t)
	app.needsMigration = true
	insertLegacyCert(t, app, "host1.example.com", testPassword)
	insertLegacyCert(t, app, "host2.example.com", testPassword)

	result, err := app.ProvideEncryptionKey(testPassword)
	if err != nil {
		t.Fatalf("ProvideEncryptionKey() error: %v", err)
	}
	if !result.Valid {
		t.Fatal("expected valid result")
	}

	// App should be unlocked with a master key
	if !app.isUnlocked {
		t.Fatal("expected app to be unlocked")
	}
	if len(app.masterKey) != 32 {
		t.Fatalf("expected 32-byte master key, got %d", len(app.masterKey))
	}
	if app.needsMigration {
		t.Fatal("needsMigration should be false after migration")
	}

	// Security key should be created
	if n := countSecurityKeys(t, app); n != 1 {
		t.Fatalf("expected 1 security key, got %d", n)
	}

	// Re-encrypted certs should be decryptable with the new master key
	certs, err := app.db.Queries().ListAllCertificates(app.ctx)
	if err != nil {
		t.Fatalf("failed to list certificates: %v", err)
	}
	for _, cert := range certs {
		if len(cert.EncryptedPrivateKey) == 0 {
			t.Fatalf("cert %s has empty encrypted key after migration", cert.Hostname)
		}
		_, err := crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, app.masterKey)
		if err != nil {
			t.Fatalf("cert %s: failed to decrypt with new master key: %v", cert.Hostname, err)
		}
	}
}

func TestProvideEncryptionKey_Migration_InvalidPassword(t *testing.T) {
	app := setupConfiguredApp(t)
	app.needsMigration = true
	insertLegacyCert(t, app, "host1.example.com", testPassword)

	_, err := app.ProvideEncryptionKey("wrong-password-16chars")
	if err == nil {
		t.Fatal("expected error for wrong password")
	}

	// App should remain locked
	if app.isUnlocked {
		t.Fatal("app should not be unlocked after failed migration")
	}

	// No security keys should be created
	if n := countSecurityKeys(t, app); n != 0 {
		t.Fatalf("expected 0 security keys after failed migration, got %d", n)
	}

	// Original certs should be unchanged (still decryptable with legacy password)
	certs, _ := app.db.Queries().ListAllCertificates(app.ctx)
	for _, cert := range certs {
		_, err := crypto.DecryptPrivateKeyLegacy(cert.EncryptedPrivateKey, testPassword)
		if err != nil {
			t.Fatalf("original cert should still be decryptable with legacy password: %v", err)
		}
	}
}

func TestProvideEncryptionKey_Migration_MultipleCertsPartialFailure(t *testing.T) {
	app := setupConfiguredApp(t)
	app.needsMigration = true

	// One cert encrypted with password A, another with password B
	insertLegacyCert(t, app, "host1.example.com", testPassword)
	insertLegacyCert(t, app, "host2.example.com", "different-password-16")

	// Using password A should fail because host2 can't be decrypted
	_, err := app.ProvideEncryptionKey(testPassword)
	if err == nil {
		t.Fatal("expected error when password doesn't work for all certs")
	}

	// App should remain locked
	if app.isUnlocked {
		t.Fatal("app should not be unlocked after partial migration failure")
	}
}

// ============================================================================
// Path 2: First-time setup (no security keys, no encrypted certs)
// ============================================================================

func TestProvideEncryptionKey_FirstTime_CreatesSecurityKey(t *testing.T) {
	app := setupConfiguredApp(t)

	result, err := app.ProvideEncryptionKey(testPassword)
	if err != nil {
		t.Fatalf("ProvideEncryptionKey() error: %v", err)
	}
	if !result.Valid {
		t.Fatal("expected valid result")
	}

	// Master key should be in memory
	if len(app.masterKey) != 32 {
		t.Fatalf("expected 32-byte master key, got %d", len(app.masterKey))
	}

	// One password security key should exist
	if n := countPasswordKeys(t, app); n != 1 {
		t.Fatalf("expected 1 password key, got %d", n)
	}

	// Services should be initialized
	if app.configService == nil {
		t.Fatal("configService should be initialized")
	}
	if app.certificateService == nil {
		t.Fatal("certificateService should be initialized")
	}
	if app.setupService == nil {
		t.Fatal("setupService should be initialized")
	}
}

func TestProvideEncryptionKey_FirstTime_Unconfigured(t *testing.T) {
	// Unconfigured app (no config row)
	app := setupTestApp(t)

	result, err := app.ProvideEncryptionKey(testPassword)
	if err != nil {
		t.Fatalf("ProvideEncryptionKey() error: %v", err)
	}
	if !result.Valid {
		t.Fatal("expected valid result")
	}

	if !app.isUnlocked {
		t.Fatal("expected app to be unlocked")
	}
	if n := countSecurityKeys(t, app); n != 1 {
		t.Fatalf("expected 1 security key, got %d", n)
	}
}

// ============================================================================
// Path 3: Normal unlock (security keys exist)
// ============================================================================

func TestProvideEncryptionKey_NormalUnlock_CorrectPassword(t *testing.T) {
	// First: set up an unlocked app, then lock it
	app := setupUnlockedApp(t)
	originalMasterKey := make([]byte, len(app.masterKey))
	copy(originalMasterKey, app.masterKey)

	// Lock the app
	if err := app.ClearEncryptionKey(); err != nil {
		t.Fatalf("ClearEncryptionKey() error: %v", err)
	}
	if app.isUnlocked {
		t.Fatal("app should be locked after ClearEncryptionKey")
	}

	// Unlock again with same password
	result, err := app.ProvideEncryptionKey(testPassword)
	if err != nil {
		t.Fatalf("ProvideEncryptionKey() error: %v", err)
	}
	if !result.Valid {
		t.Fatal("expected valid result")
	}

	// Master key should match the original
	if len(app.masterKey) != 32 {
		t.Fatalf("expected 32-byte master key, got %d", len(app.masterKey))
	}

	// The unwrapped master key should match what we had before locking
	for i := range originalMasterKey {
		if app.masterKey[i] != originalMasterKey[i] {
			t.Fatal("unwrapped master key doesn't match the original")
		}
	}
}

func TestProvideEncryptionKey_NormalUnlock_IncorrectPassword(t *testing.T) {
	app := setupUnlockedApp(t)

	// Lock
	app.ClearEncryptionKey()

	// Try wrong password
	result, err := app.ProvideEncryptionKey("wrong-password-16chars")
	if err == nil {
		t.Fatal("expected error for wrong password")
	}
	if result != nil && result.Valid {
		t.Fatal("result should not be valid for wrong password")
	}

	if app.isUnlocked {
		t.Fatal("app should remain locked after wrong password")
	}
}

func TestProvideEncryptionKey_NormalUnlock_MultiplePasswordMethods(t *testing.T) {
	app := setupUnlockedApp(t)
	secondPassword := "second-password-at-least-16"

	// Enroll a second password method
	if err := app.EnrollPasswordMethod(secondPassword, "Second Password"); err != nil {
		t.Fatalf("EnrollPasswordMethod() error: %v", err)
	}
	if n := countPasswordKeys(t, app); n != 2 {
		t.Fatalf("expected 2 password keys, got %d", n)
	}

	// Lock
	app.ClearEncryptionKey()

	// Unlock with the second password
	result, err := app.ProvideEncryptionKey(secondPassword)
	if err != nil {
		t.Fatalf("ProvideEncryptionKey() with second password error: %v", err)
	}
	if !result.Valid {
		t.Fatal("expected valid result with second password")
	}
	if !app.isUnlocked {
		t.Fatal("app should be unlocked")
	}
}

// ============================================================================
// Validation
// ============================================================================

func TestProvideEncryptionKey_EmptyPassword(t *testing.T) {
	app := setupConfiguredApp(t)

	_, err := app.ProvideEncryptionKey("")
	if err == nil {
		t.Fatal("expected error for empty password")
	}
}

func TestProvideEncryptionKey_ShortPassword(t *testing.T) {
	app := setupConfiguredApp(t)

	_, err := app.ProvideEncryptionKey("short")
	if err == nil {
		t.Fatal("expected error for short password")
	}
}

func TestProvideEncryptionKey_NilDatabase(t *testing.T) {
	app := &App{ctx: context.Background(), db: nil}

	_, err := app.ProvideEncryptionKey(testPassword)
	if err == nil {
		t.Fatal("expected error when database is nil")
	}
}

// ============================================================================
// ChangeEncryptionKey
// ============================================================================

func TestChangeEncryptionKey_Success(t *testing.T) {
	app := setupUnlockedApp(t)
	originalMasterKey := make([]byte, len(app.masterKey))
	copy(originalMasterKey, app.masterKey)

	newPassword := "new-password-at-least-16-chars"
	if err := app.ChangeEncryptionKey(newPassword); err != nil {
		t.Fatalf("ChangeEncryptionKey() error: %v", err)
	}

	// Master key in memory should be unchanged
	for i := range originalMasterKey {
		if app.masterKey[i] != originalMasterKey[i] {
			t.Fatal("master key in memory should not change during password change")
		}
	}

	// Should have exactly 1 password key (old one deleted, new one inserted)
	if n := countPasswordKeys(t, app); n != 1 {
		t.Fatalf("expected 1 password key after change, got %d", n)
	}

	// Lock and unlock with new password
	app.ClearEncryptionKey()
	result, err := app.ProvideEncryptionKey(newPassword)
	if err != nil {
		t.Fatalf("unlock with new password failed: %v", err)
	}
	if !result.Valid {
		t.Fatal("expected valid result with new password")
	}

	// Old password should no longer work
	app.ClearEncryptionKey()
	_, err = app.ProvideEncryptionKey(testPassword)
	if err == nil {
		t.Fatal("old password should no longer work")
	}
}

func TestChangeEncryptionKey_NoCertReEncryption(t *testing.T) {
	app := setupUnlockedApp(t)

	// Generate a cert so there's something encrypted
	key, _ := crypto.GenerateRSAKey(2048)
	keyPEM, _ := crypto.PrivateKeyToPEM(key)
	encrypted, _ := crypto.EncryptPrivateKey(keyPEM, app.masterKey)

	app.db.Queries().CreateCertificate(app.ctx, sqlc.CreateCertificateParams{
		Hostname:            "test.example.com",
		EncryptedPrivateKey: encrypted,
	})

	// Snapshot the encrypted blob
	certBefore, _ := app.db.Queries().GetCertificateByHostname(app.ctx, "test.example.com")
	encryptedBefore := make([]byte, len(certBefore.EncryptedPrivateKey))
	copy(encryptedBefore, certBefore.EncryptedPrivateKey)

	// Change password
	app.ChangeEncryptionKey("new-password-at-least-16-chars")

	// Encrypted key should be IDENTICAL (no re-encryption)
	certAfter, _ := app.db.Queries().GetCertificateByHostname(app.ctx, "test.example.com")
	if len(encryptedBefore) != len(certAfter.EncryptedPrivateKey) {
		t.Fatal("encrypted key length changed — cert was re-encrypted")
	}
	for i := range encryptedBefore {
		if encryptedBefore[i] != certAfter.EncryptedPrivateKey[i] {
			t.Fatal("encrypted key blob changed — cert was re-encrypted")
		}
	}
}

func TestChangeEncryptionKey_RequiresUnlocked(t *testing.T) {
	app := setupConfiguredApp(t) // configured but locked

	err := app.ChangeEncryptionKey("new-password-at-least-16-chars")
	if err == nil {
		t.Fatal("expected error when app is locked")
	}
}

func TestChangeEncryptionKey_ShortPassword(t *testing.T) {
	app := setupUnlockedApp(t)

	err := app.ChangeEncryptionKey("short")
	if err == nil {
		t.Fatal("expected error for short password")
	}
}

// ============================================================================
// ClearEncryptionKey
// ============================================================================

func TestClearEncryptionKey_ZeroesMasterKey(t *testing.T) {
	app := setupUnlockedApp(t)
	masterKeyRef := app.masterKey // shallow reference

	if err := app.ClearEncryptionKey(); err != nil {
		t.Fatalf("ClearEncryptionKey() error: %v", err)
	}

	// The original slice should be zeroed
	for _, b := range masterKeyRef {
		if b != 0 {
			t.Fatal("master key bytes should be zeroed after clear")
		}
	}

	if app.masterKey != nil {
		t.Fatal("masterKey should be nil after clear")
	}
	if app.isUnlocked {
		t.Fatal("app should be locked after clear")
	}
}

func TestClearEncryptionKey_WhenLocked(t *testing.T) {
	app := setupConfiguredApp(t)

	err := app.ClearEncryptionKey()
	if err == nil {
		t.Fatal("expected error when already locked")
	}
}

// ============================================================================
// EnrollPasswordMethod
// ============================================================================

func TestEnrollPasswordMethod_AddsSecondEntry(t *testing.T) {
	app := setupUnlockedApp(t)

	before := countPasswordKeys(t, app)
	if err := app.EnrollPasswordMethod("another-password-16char", "Backup Password"); err != nil {
		t.Fatalf("EnrollPasswordMethod() error: %v", err)
	}

	after := countPasswordKeys(t, app)
	if after != before+1 {
		t.Fatalf("expected %d password keys, got %d", before+1, after)
	}
}

func TestEnrollPasswordMethod_DefaultLabel(t *testing.T) {
	app := setupUnlockedApp(t)

	if err := app.EnrollPasswordMethod("another-password-16char", ""); err != nil {
		t.Fatalf("EnrollPasswordMethod() error: %v", err)
	}

	keys, _ := app.ListSecurityKeys()
	found := false
	for _, k := range keys {
		if k.Label == "Password" && k.ID > 1 { // first one is from setup
			found = true
		}
	}
	if !found {
		t.Fatal("expected default label 'Password' for empty label")
	}
}

func TestEnrollPasswordMethod_RequiresUnlocked(t *testing.T) {
	app := setupConfiguredApp(t)

	err := app.EnrollPasswordMethod("another-password-16char", "Test")
	if err == nil {
		t.Fatal("expected error when app is locked")
	}
}

func TestEnrollPasswordMethod_ShortPassword(t *testing.T) {
	app := setupUnlockedApp(t)

	err := app.EnrollPasswordMethod("short", "Test")
	if err == nil {
		t.Fatal("expected error for short password")
	}
}

// ============================================================================
// RemoveSecurityKey
// ============================================================================

func TestRemoveSecurityKey_CannotRemoveLastPassword(t *testing.T) {
	app := setupUnlockedApp(t)

	keys, _ := app.ListSecurityKeys()
	if len(keys) != 1 {
		t.Fatalf("expected exactly 1 key, got %d", len(keys))
	}

	err := app.RemoveSecurityKey(keys[0].ID)
	if err == nil {
		t.Fatal("should not allow removing the last password method")
	}
}

func TestRemoveSecurityKey_CanRemoveSecondPassword(t *testing.T) {
	app := setupUnlockedApp(t)

	// Enroll second password
	app.EnrollPasswordMethod("second-password-16-chars", "Second")

	keys, _ := app.ListSecurityKeys()
	if len(keys) != 2 {
		t.Fatalf("expected 2 keys, got %d", len(keys))
	}

	// Remove the second one
	err := app.RemoveSecurityKey(keys[1].ID)
	if err != nil {
		t.Fatalf("RemoveSecurityKey() error: %v", err)
	}

	if n := countPasswordKeys(t, app); n != 1 {
		t.Fatalf("expected 1 password key after removal, got %d", n)
	}
}

func TestRemoveSecurityKey_NotFound(t *testing.T) {
	app := setupUnlockedApp(t)

	err := app.RemoveSecurityKey(9999)
	if err == nil {
		t.Fatal("expected error for non-existent key ID")
	}
}

// ============================================================================
// TryAutoUnlock
// ============================================================================

func TestTryAutoUnlock_AlreadyUnlocked(t *testing.T) {
	app := setupUnlockedApp(t)

	ok, err := app.TryAutoUnlock()
	if err != nil {
		t.Fatalf("TryAutoUnlock() error: %v", err)
	}
	if !ok {
		t.Fatal("expected true when already unlocked")
	}
}

func TestTryAutoUnlock_NilDatabase(t *testing.T) {
	app := &App{db: nil}

	ok, err := app.TryAutoUnlock()
	if err != nil {
		t.Fatalf("TryAutoUnlock() error: %v", err)
	}
	if ok {
		t.Fatal("expected false when database is nil")
	}
}

func TestTryAutoUnlock_NoOSNativeEntries(t *testing.T) {
	app := setupUnlockedApp(t)
	app.ClearEncryptionKey()

	// Only password entries exist — no OS-native
	ok, err := app.TryAutoUnlock()
	if err != nil {
		t.Fatalf("TryAutoUnlock() error: %v", err)
	}
	if ok {
		t.Fatal("expected false when no OS-native entries exist")
	}
}

// ============================================================================
// ListSecurityKeys
// ============================================================================

func TestListSecurityKeys_ExcludesWrappedKey(t *testing.T) {
	app := setupUnlockedApp(t)

	keys, err := app.ListSecurityKeys()
	if err != nil {
		t.Fatalf("ListSecurityKeys() error: %v", err)
	}
	if len(keys) == 0 {
		t.Fatal("expected at least 1 security key")
	}

	// SecurityKeyInfo should not expose the wrapped master key
	// (the struct simply doesn't have the field — this is a compile-time guarantee,
	// but we verify the response is populated correctly)
	for _, k := range keys {
		if k.Method != models.SecurityKeyMethodPassword {
			t.Fatalf("expected password method, got %s", k.Method)
		}
		if k.Label == "" {
			t.Fatal("expected non-empty label")
		}
		if k.CreatedAt == 0 {
			t.Fatal("expected non-zero created_at")
		}
	}
}

func TestListSecurityKeys_EmptyList(t *testing.T) {
	app := setupTestApp(t) // no security keys

	keys, err := app.ListSecurityKeys()
	if err != nil {
		t.Fatalf("ListSecurityKeys() error: %v", err)
	}
	if keys == nil {
		t.Fatal("expected empty slice, not nil")
	}
	if len(keys) != 0 {
		t.Fatalf("expected 0 keys, got %d", len(keys))
	}
}
