package testutil

import (
	"crypto/rand"
	"encoding/hex"
	"testing"
)

// BackupsSubdir is the subdirectory name where backup files are stored.
const BackupsSubdir = "backups"

// RandomEncryptionKey generates a random 32-byte hex-encoded encryption key for testing.
// DEPRECATED: Use RandomMasterKey for new code.
func RandomEncryptionKey(t *testing.T) string {
	t.Helper()
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		t.Fatalf("failed to generate random encryption key: %v", err)
	}
	return hex.EncodeToString(b)
}

// RandomMasterKey generates a random 32-byte master key for testing.
func RandomMasterKey(t *testing.T) []byte {
	t.Helper()
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		t.Fatalf("failed to generate random master key: %v", err)
	}
	return b
}
