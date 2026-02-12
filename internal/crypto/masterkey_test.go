package crypto

import (
	"testing"
)

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
