package crypto

import (
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"math/big"
	"testing"
	"time"
)

func TestValidateKeyMatches_MatchingCSR(t *testing.T) {
	encryptionKey := "test-key-123"

	key, err := GenerateRSAKey(2048)
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	csrPEM, err := CreateCSR(CSRRequest{
		CommonName:   "test.example.com",
		Organization: "Test Org",
		City:         "Test City",
		State:        "Test State",
		Country:      "FR",
	}, key)
	if err != nil {
		t.Fatalf("failed to create CSR: %v", err)
	}

	keyPEM, err := PrivateKeyToPEM(key)
	if err != nil {
		t.Fatalf("failed to encode key: %v", err)
	}

	encryptedKey, err := EncryptPrivateKey(keyPEM, encryptionKey)
	if err != nil {
		t.Fatalf("failed to encrypt key: %v", err)
	}

	csrStr := string(csrPEM)
	result := ValidateKeyMatches(encryptedKey, &csrStr, nil, encryptionKey)

	if !result.KeyPresent {
		t.Error("expected KeyPresent to be true")
	}
	if result.KeyMatchesCSR == nil || !*result.KeyMatchesCSR {
		t.Error("expected KeyMatchesCSR to be true")
	}
	if result.Error != "" {
		t.Errorf("unexpected error: %s", result.Error)
	}
}

func TestValidateKeyMatches_MatchingCert(t *testing.T) {
	encryptionKey := "test-key-123"

	key, err := GenerateRSAKey(2048)
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	// Create self-signed certificate with this key
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		DNSNames:     []string{"test.example.com"},
	}
	certDER, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}
	certPEMStr := string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER}))

	keyPEM, err := PrivateKeyToPEM(key)
	if err != nil {
		t.Fatalf("failed to encode key: %v", err)
	}

	encryptedKey, err := EncryptPrivateKey(keyPEM, encryptionKey)
	if err != nil {
		t.Fatalf("failed to encrypt key: %v", err)
	}

	result := ValidateKeyMatches(encryptedKey, nil, &certPEMStr, encryptionKey)

	if !result.KeyPresent {
		t.Error("expected KeyPresent to be true")
	}
	if result.KeyMatchesCert == nil || !*result.KeyMatchesCert {
		t.Error("expected KeyMatchesCert to be true")
	}
	if result.Error != "" {
		t.Errorf("unexpected error: %s", result.Error)
	}
}

func TestValidateKeyMatches_MismatchingCert(t *testing.T) {
	encryptionKey := "test-key-123"

	// Key A — the encrypted key
	keyA, err := GenerateRSAKey(2048)
	if err != nil {
		t.Fatalf("failed to generate key A: %v", err)
	}
	keyAPEM, err := PrivateKeyToPEM(keyA)
	if err != nil {
		t.Fatalf("failed to encode key A: %v", err)
	}
	encryptedKeyA, err := EncryptPrivateKey(keyAPEM, encryptionKey)
	if err != nil {
		t.Fatalf("failed to encrypt key A: %v", err)
	}

	// Key B — used to sign a certificate (different key)
	keyB, err := GenerateRSAKey(2048)
	if err != nil {
		t.Fatalf("failed to generate key B: %v", err)
	}
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		DNSNames:     []string{"test.example.com"},
	}
	certDER, err := x509.CreateCertificate(rand.Reader, template, template, &keyB.PublicKey, keyB)
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}
	certPEMStr := string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER}))

	result := ValidateKeyMatches(encryptedKeyA, nil, &certPEMStr, encryptionKey)

	if !result.KeyPresent {
		t.Error("expected KeyPresent to be true")
	}
	if result.KeyMatchesCert == nil || *result.KeyMatchesCert {
		t.Error("expected KeyMatchesCert to be false for mismatched key")
	}
	if result.Error == "" {
		t.Error("expected an error message about key mismatch")
	}
}

func TestValidateKeyMatches_NoKey(t *testing.T) {
	result := ValidateKeyMatches(nil, nil, nil, "any-key")

	if result.KeyPresent {
		t.Error("expected KeyPresent to be false")
	}
	if result.Error == "" {
		t.Error("expected an error about missing key")
	}
}
