package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"io"
	"log/slog"

	"paddockcontrol-desktop/internal/logger"
)

// DecryptPrivateKeyLegacy decrypts data encrypted with the pre-v1.4.0 SHA-256(password) format.
// DEPRECATED(v2.0.0): Remove legacy SHA-256 support.
// This function exists only for migrating pre-v1.4.0 databases.
func DecryptPrivateKeyLegacy(encryptedData []byte, password string) ([]byte, error) {
	log := logger.WithComponent("crypto")
	log.Debug("decrypting private key (legacy SHA-256 format)", slog.Int("encrypted_size", len(encryptedData)))

	keyHash := sha256.Sum256([]byte(password))

	block, err := aes.NewCipher(keyHash[:])
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(encryptedData) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := encryptedData[:nonceSize], encryptedData[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	return plaintext, nil
}

// EncryptPrivateKeyLegacy encrypts data with the pre-v1.4.0 SHA-256(password) format.
// DEPRECATED(v2.0.0): Remove legacy SHA-256 support.
// This function exists only for the transitional period before full master key wrapping rewrite.
func EncryptPrivateKeyLegacy(pemData []byte, password string) ([]byte, error) {
	log := logger.WithComponent("crypto")
	log.Debug("encrypting private key (legacy SHA-256 format)", slog.Int("data_size", len(pemData)))

	keyHash := sha256.Sum256([]byte(password))

	block, err := aes.NewCipher(keyHash[:])
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

	ciphertext := gcm.Seal(nonce, nonce, pemData, nil)

	for i := range pemData {
		pemData[i] = 0
	}

	return ciphertext, nil
}

// EncryptPrivateKey encrypts private key PEM data using AES-256-GCM.
// The key must be exactly 32 bytes (the raw master key).
// Returns: nonce (12 bytes) + ciphertext.
func EncryptPrivateKey(pemData []byte, key []byte) ([]byte, error) {
	log := logger.WithComponent("crypto")
	log.Debug("encrypting private key", slog.Int("data_size", len(pemData)))

	if len(key) != 32 {
		return nil, fmt.Errorf("encryption key must be exactly 32 bytes, got %d", len(key))
	}

	// Create AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		log.Error("failed to create cipher", logger.Err(err))
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		log.Error("failed to create GCM", logger.Err(err))
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Generate random nonce (IV)
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		log.Error("failed to generate nonce", logger.Err(err))
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt (nonce will be prepended to ciphertext by Seal)
	ciphertext := gcm.Seal(nonce, nonce, pemData, nil)

	// Wipe plaintext from memory
	for i := range pemData {
		pemData[i] = 0
	}

	log.Debug("private key encrypted successfully", slog.Int("encrypted_size", len(ciphertext)))
	return ciphertext, nil
}

// DecryptPrivateKey decrypts private key data using AES-256-GCM.
// The key must be exactly 32 bytes (the raw master key).
// Expects: nonce (12 bytes) + ciphertext.
func DecryptPrivateKey(encryptedData []byte, key []byte) ([]byte, error) {
	log := logger.WithComponent("crypto")
	log.Debug("decrypting private key", slog.Int("encrypted_size", len(encryptedData)))

	if len(key) != 32 {
		return nil, fmt.Errorf("decryption key must be exactly 32 bytes, got %d", len(key))
	}

	// Create AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		log.Error("failed to create cipher", logger.Err(err))
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		log.Error("failed to create GCM", logger.Err(err))
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Check minimum length
	nonceSize := gcm.NonceSize()
	if len(encryptedData) < nonceSize {
		log.Error("ciphertext too short", slog.Int("size", len(encryptedData)), slog.Int("min_size", nonceSize))
		return nil, fmt.Errorf("ciphertext too short")
	}

	// Extract nonce and ciphertext
	nonce, ciphertext := encryptedData[:nonceSize], encryptedData[nonceSize:]

	// Decrypt
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		log.Error("failed to decrypt", logger.Err(err))
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	log.Debug("private key decrypted successfully", slog.Int("decrypted_size", len(plaintext)))
	return plaintext, nil
}
