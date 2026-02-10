package testutil

import (
	"crypto/rand"
	"encoding/hex"
	"testing"
)

// RandomEncryptionKey generates a random 32-byte hex-encoded encryption key for testing.
func RandomEncryptionKey(t *testing.T) string {
	t.Helper()
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		t.Fatalf("failed to generate random encryption key: %v", err)
	}
	return hex.EncodeToString(b)
}
