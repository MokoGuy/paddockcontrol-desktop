package crypto

import (
	"bytes"
	"testing"
)

func TestDefaultArgon2idParams(t *testing.T) {
	params := DefaultArgon2idParams()
	if params.Memory != 64*1024 {
		t.Errorf("expected memory 64 MiB (65536 KiB), got %d", params.Memory)
	}
	if params.Iterations != 3 {
		t.Errorf("expected 3 iterations, got %d", params.Iterations)
	}
	if params.Parallelism != 4 {
		t.Errorf("expected 4 parallelism, got %d", params.Parallelism)
	}
	if params.KeyLength != 32 {
		t.Errorf("expected 32 key length, got %d", params.KeyLength)
	}
	if params.SaltLength != 16 {
		t.Errorf("expected 16 salt length, got %d", params.SaltLength)
	}
}

func TestGenerateSalt(t *testing.T) {
	salt, err := GenerateSalt(16)
	if err != nil {
		t.Fatalf("GenerateSalt() error: %v", err)
	}
	if len(salt) != 16 {
		t.Fatalf("expected 16 bytes, got %d", len(salt))
	}

	salt2, err := GenerateSalt(16)
	if err != nil {
		t.Fatalf("GenerateSalt() second call error: %v", err)
	}
	if bytes.Equal(salt, salt2) {
		t.Fatal("two generated salts should not be equal")
	}
}

func TestDeriveKeyFromPassword(t *testing.T) {
	params := DefaultArgon2idParams()
	salt := []byte("0123456789abcdef") // 16 bytes

	key := DeriveKeyFromPassword("test-password-16", salt, params)
	if len(key) != 32 {
		t.Fatalf("expected 32 bytes, got %d", len(key))
	}

	// Same password + same salt = same key (deterministic)
	key2 := DeriveKeyFromPassword("test-password-16", salt, params)
	if !bytes.Equal(key, key2) {
		t.Fatal("same password and salt should produce same key")
	}
}

func TestDeriveKeyDifferentSalts(t *testing.T) {
	params := DefaultArgon2idParams()
	salt1 := []byte("0123456789abcdef")
	salt2 := []byte("fedcba9876543210")

	key1 := DeriveKeyFromPassword("test-password-16", salt1, params)
	key2 := DeriveKeyFromPassword("test-password-16", salt2, params)

	if bytes.Equal(key1, key2) {
		t.Fatal("different salts should produce different keys")
	}
}

func TestDeriveKeyDifferentPasswords(t *testing.T) {
	params := DefaultArgon2idParams()
	salt := []byte("0123456789abcdef")

	key1 := DeriveKeyFromPassword("password-alpha!!", salt, params)
	key2 := DeriveKeyFromPassword("password-bravo!!", salt, params)

	if bytes.Equal(key1, key2) {
		t.Fatal("different passwords should produce different keys")
	}
}
