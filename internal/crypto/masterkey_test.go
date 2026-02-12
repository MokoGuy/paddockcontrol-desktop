package crypto

import (
	"bytes"
	"testing"
)

func TestGenerateMasterKey(t *testing.T) {
	key, err := GenerateMasterKey()
	if err != nil {
		t.Fatalf("GenerateMasterKey() error: %v", err)
	}
	if len(key) != 32 {
		t.Fatalf("expected 32 bytes, got %d", len(key))
	}

	// Two generated keys should be different
	key2, err := GenerateMasterKey()
	if err != nil {
		t.Fatalf("GenerateMasterKey() second call error: %v", err)
	}
	if bytes.Equal(key, key2) {
		t.Fatal("two generated keys should not be equal")
	}
}

func TestWrapUnwrapMasterKey(t *testing.T) {
	masterKey, err := GenerateMasterKey()
	if err != nil {
		t.Fatalf("GenerateMasterKey() error: %v", err)
	}

	wrappingKey, err := GenerateMasterKey() // reuse for 32-byte key
	if err != nil {
		t.Fatalf("GenerateMasterKey() error: %v", err)
	}

	wrapped, err := WrapMasterKey(masterKey, wrappingKey)
	if err != nil {
		t.Fatalf("WrapMasterKey() error: %v", err)
	}

	unwrapped, err := UnwrapMasterKey(wrapped, wrappingKey)
	if err != nil {
		t.Fatalf("UnwrapMasterKey() error: %v", err)
	}

	if !bytes.Equal(masterKey, unwrapped) {
		t.Fatal("unwrapped key does not match original")
	}
}

func TestWrapUnwrapWrongKey(t *testing.T) {
	masterKey, _ := GenerateMasterKey()
	wrappingKey, _ := GenerateMasterKey()
	wrongKey, _ := GenerateMasterKey()

	wrapped, err := WrapMasterKey(masterKey, wrappingKey)
	if err != nil {
		t.Fatalf("WrapMasterKey() error: %v", err)
	}

	_, err = UnwrapMasterKey(wrapped, wrongKey)
	if err == nil {
		t.Fatal("UnwrapMasterKey() should fail with wrong key")
	}
}

func TestWrapMasterKeyInvalidKeyLength(t *testing.T) {
	masterKey, _ := GenerateMasterKey()

	_, err := WrapMasterKey(masterKey, []byte("short"))
	if err == nil {
		t.Fatal("WrapMasterKey() should fail with short wrapping key")
	}

	_, err = UnwrapMasterKey([]byte("data"), []byte("short"))
	if err == nil {
		t.Fatal("UnwrapMasterKey() should fail with short wrapping key")
	}
}

func TestUnwrapMasterKeyTooShort(t *testing.T) {
	wrappingKey, _ := GenerateMasterKey()

	_, err := UnwrapMasterKey([]byte("short"), wrappingKey)
	if err == nil {
		t.Fatal("UnwrapMasterKey() should fail with too-short wrapped data")
	}
}
