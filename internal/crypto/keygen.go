package crypto

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"log/slog"

	"paddockcontrol-desktop/internal/logger"
)

// GenerateRSAKey generates a new RSA private key with the specified key size
func GenerateRSAKey(keySize int) (*rsa.PrivateKey, error) {
	log := logger.WithComponent("crypto")
	log.Debug("generating RSA key", slog.Int("key_size", keySize))

	if keySize < 2048 {
		log.Error("key size too small", slog.Int("key_size", keySize), slog.Int("min_size", 2048))
		return nil, fmt.Errorf("key size must be at least 2048 bits")
	}

	key, err := rsa.GenerateKey(rand.Reader, keySize)
	if err != nil {
		log.Error("failed to generate RSA key", logger.Err(err))
		return nil, fmt.Errorf("failed to generate RSA key: %w", err)
	}

	log.Debug("RSA key generated successfully", slog.Int("key_size", keySize))
	return key, nil
}

// PrivateKeyToPEM converts an RSA private key to PEM format
func PrivateKeyToPEM(key *rsa.PrivateKey) ([]byte, error) {
	log := logger.WithComponent("crypto")
	log.Debug("converting private key to PEM")

	keyBytes := x509.MarshalPKCS1PrivateKey(key)
	pemBlock := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: keyBytes,
	}
	pemData := pem.EncodeToMemory(pemBlock)

	log.Debug("private key converted to PEM", slog.Int("pem_size", len(pemData)))
	return pemData, nil
}

// ParsePrivateKeyFromPEM parses an RSA private key from PEM format
// Supports both PKCS#1 (-----BEGIN RSA PRIVATE KEY-----) and PKCS#8 (-----BEGIN PRIVATE KEY-----) formats
func ParsePrivateKeyFromPEM(pemData []byte) (*rsa.PrivateKey, error) {
	log := logger.WithComponent("crypto")
	log.Debug("parsing private key from PEM", slog.Int("pem_size", len(pemData)))

	block, _ := pem.Decode(pemData)
	if block == nil {
		log.Error("failed to decode PEM block")
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	// Try PKCS#1 format first (-----BEGIN RSA PRIVATE KEY-----)
	if block.Type == "RSA PRIVATE KEY" {
		key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			log.Error("failed to parse PKCS#1 private key", logger.Err(err))
			return nil, fmt.Errorf("failed to parse PKCS#1 private key: %w", err)
		}
		log.Debug("parsed PKCS#1 private key successfully")
		return key, nil
	}

	// Try PKCS#8 format (-----BEGIN PRIVATE KEY-----)
	if block.Type == "PRIVATE KEY" {
		key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			log.Error("failed to parse PKCS#8 private key", logger.Err(err))
			return nil, fmt.Errorf("failed to parse PKCS#8 private key: %w", err)
		}

		// Ensure it's an RSA key
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			log.Error("private key is not RSA", slog.String("type", fmt.Sprintf("%T", key)))
			return nil, fmt.Errorf("private key is not RSA (got %T)", key)
		}

		log.Debug("parsed PKCS#8 private key successfully")
		return rsaKey, nil
	}

	log.Error("invalid PEM type", slog.String("type", block.Type))
	return nil, fmt.Errorf("invalid PEM type: %s (expected RSA PRIVATE KEY or PRIVATE KEY)", block.Type)
}
