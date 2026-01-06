package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"io"
)

// EncryptPrivateKey encrypts private key PEM data using AES-256-GCM
// The encryption key is derived from the master key using SHA-256
// Returns: IV (12 bytes) + ciphertext
func EncryptPrivateKey(pemData []byte, masterKey string) ([]byte, error) {
	// Derive AES key from master key using SHA-256
	keyHash := sha256.Sum256([]byte(masterKey))

	// Create AES cipher
	block, err := aes.NewCipher(keyHash[:])
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Generate random nonce (IV)
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt (nonce will be prepended to ciphertext by Seal)
	ciphertext := gcm.Seal(nonce, nonce, pemData, nil)

	// Wipe plaintext from memory
	for i := range pemData {
		pemData[i] = 0
	}

	return ciphertext, nil
}

// DecryptPrivateKey decrypts private key data using AES-256-GCM
// Expects: IV (12 bytes) + ciphertext
func DecryptPrivateKey(encryptedData []byte, masterKey string) ([]byte, error) {
	// Derive AES key from master key using SHA-256
	keyHash := sha256.Sum256([]byte(masterKey))

	// Create AES cipher
	block, err := aes.NewCipher(keyHash[:])
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Check minimum length
	nonceSize := gcm.NonceSize()
	if len(encryptedData) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	// Extract nonce and ciphertext
	nonce, ciphertext := encryptedData[:nonceSize], encryptedData[nonceSize:]

	// Decrypt
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	return plaintext, nil
}
