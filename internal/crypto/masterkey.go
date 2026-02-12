package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"io"
)

// GenerateMasterKey generates a cryptographically random 32-byte master key.
func GenerateMasterKey() ([]byte, error) {
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("failed to generate master key: %w", err)
	}
	return key, nil
}

// WrapMasterKey encrypts the master key with a wrapping key using AES-256-GCM.
// Returns: nonce (12 bytes) + ciphertext.
func WrapMasterKey(masterKey, wrappingKey []byte) ([]byte, error) {
	if len(wrappingKey) != 32 {
		return nil, fmt.Errorf("wrapping key must be exactly 32 bytes, got %d", len(wrappingKey))
	}

	block, err := aes.NewCipher(wrappingKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	return gcm.Seal(nonce, nonce, masterKey, nil), nil
}

// UnwrapMasterKey decrypts the master key with a wrapping key using AES-256-GCM.
// Expects: nonce (12 bytes) + ciphertext.
func UnwrapMasterKey(wrappedKey, wrappingKey []byte) ([]byte, error) {
	if len(wrappingKey) != 32 {
		return nil, fmt.Errorf("wrapping key must be exactly 32 bytes, got %d", len(wrappingKey))
	}

	block, err := aes.NewCipher(wrappingKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(wrappedKey) < nonceSize {
		return nil, fmt.Errorf("wrapped key too short")
	}

	nonce, ciphertext := wrappedKey[:nonceSize], wrappedKey[nonceSize:]
	masterKey, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to unwrap master key: %w", err)
	}

	return masterKey, nil
}
