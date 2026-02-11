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

// EncryptPrivateKey encrypts private key PEM data using AES-256-GCM
// The encryption key is derived from the master key using SHA-256
// Returns: IV (12 bytes) + ciphertext
func EncryptPrivateKey(pemData []byte, masterKey string) ([]byte, error) {
	log := logger.WithComponent("crypto")
	log.Debug("encrypting private key", slog.Int("data_size", len(pemData)))

	// Derive AES key from master key using SHA-256
	keyHash := sha256.Sum256([]byte(masterKey))

	// Create AES cipher
	block, err := aes.NewCipher(keyHash[:])
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

// DecryptPrivateKey decrypts private key data using AES-256-GCM
// Expects: IV (12 bytes) + ciphertext
func DecryptPrivateKey(encryptedData []byte, masterKey string) ([]byte, error) {
	log := logger.WithComponent("crypto")
	log.Debug("decrypting private key", slog.Int("encrypted_size", len(encryptedData)))

	// Derive AES key from master key using SHA-256
	keyHash := sha256.Sum256([]byte(masterKey))

	// Create AES cipher
	block, err := aes.NewCipher(keyHash[:])
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
