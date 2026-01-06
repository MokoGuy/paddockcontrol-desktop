package crypto

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
)

// GenerateRSAKey generates a new RSA private key with the specified key size
func GenerateRSAKey(keySize int) (*rsa.PrivateKey, error) {
	if keySize < 2048 {
		return nil, fmt.Errorf("key size must be at least 2048 bits")
	}

	key, err := rsa.GenerateKey(rand.Reader, keySize)
	if err != nil {
		return nil, fmt.Errorf("failed to generate RSA key: %w", err)
	}

	return key, nil
}

// PrivateKeyToPEM converts an RSA private key to PEM format
func PrivateKeyToPEM(key *rsa.PrivateKey) ([]byte, error) {
	keyBytes := x509.MarshalPKCS1PrivateKey(key)
	pemBlock := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: keyBytes,
	}
	return pem.EncodeToMemory(pemBlock), nil
}

// ParsePrivateKeyFromPEM parses an RSA private key from PEM format
// Supports both PKCS#1 (-----BEGIN RSA PRIVATE KEY-----) and PKCS#8 (-----BEGIN PRIVATE KEY-----) formats
func ParsePrivateKeyFromPEM(pemData []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(pemData)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	// Try PKCS#1 format first (-----BEGIN RSA PRIVATE KEY-----)
	if block.Type == "RSA PRIVATE KEY" {
		key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse PKCS#1 private key: %w", err)
		}
		return key, nil
	}

	// Try PKCS#8 format (-----BEGIN PRIVATE KEY-----)
	if block.Type == "PRIVATE KEY" {
		key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse PKCS#8 private key: %w", err)
		}

		// Ensure it's an RSA key
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("private key is not RSA (got %T)", key)
		}

		return rsaKey, nil
	}

	return nil, fmt.Errorf("invalid PEM type: %s (expected RSA PRIVATE KEY or PRIVATE KEY)", block.Type)
}
