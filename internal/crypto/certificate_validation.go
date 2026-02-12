package crypto

import (
	"crypto/rsa"
	"crypto/x509"
	"fmt"
)

// ExtractPublicKey extracts the public key from a certificate
func ExtractPublicKey(cert *x509.Certificate) (*rsa.PublicKey, error) {
	pubKey, ok := cert.PublicKey.(*rsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("certificate does not contain an RSA public key")
	}
	return pubKey, nil
}

// ComparePublicKeys compares two RSA public keys for equality
func ComparePublicKeys(key1, key2 *rsa.PublicKey) bool {
	return key1.N.Cmp(key2.N) == 0 && key1.E == key2.E
}

// ValidateCSRMatch validates that a certificate matches a CSR (same public key)
func ValidateCSRMatch(csr *x509.CertificateRequest, cert *x509.Certificate) error {
	csrPubKey, ok := csr.PublicKey.(*rsa.PublicKey)
	if !ok {
		return fmt.Errorf("CSR does not contain an RSA public key")
	}

	certPubKey, ok := cert.PublicKey.(*rsa.PublicKey)
	if !ok {
		return fmt.Errorf("certificate does not contain an RSA public key")
	}

	if !ComparePublicKeys(csrPubKey, certPubKey) {
		return fmt.Errorf("certificate public key does not match CSR public key")
	}

	return nil
}

// ValidateCertificateAndKey validates that a certificate and private key match
func ValidateCertificateAndKey(certPEM, keyPEM string) error {
	// Parse certificate
	cert, err := ParseCertificate([]byte(certPEM))
	if err != nil {
		return fmt.Errorf("invalid certificate: %w", err)
	}

	// Parse private key
	privateKey, err := ParsePrivateKeyFromPEM([]byte(keyPEM))
	if err != nil {
		return fmt.Errorf("invalid private key: %w", err)
	}

	// Extract certificate's public key
	certPubKey, err := ExtractPublicKey(cert)
	if err != nil {
		return fmt.Errorf("failed to extract public key from certificate: %w", err)
	}

	// Compare public keys
	if !ComparePublicKeys(certPubKey, &privateKey.PublicKey) {
		return fmt.Errorf("private key does not match certificate")
	}

	return nil
}

// KeyValidationResult represents the result of key validation
type KeyValidationResult struct {
	KeyPresent     bool
	KeyMatchesCSR  *bool // nil if CSR doesn't exist, true/false if it does
	KeyMatchesCert *bool // nil if cert doesn't exist, true/false if it does
	Error          string
}

// ValidateKeyMatches validates that the encrypted private key matches the CSR or certificate
// encryptedKey: the encrypted private key from the database
// csrPEM: optional CSR PEM string (can be nil)
// certPEM: optional certificate PEM string (can be nil)
// encryptionKey: the encryption key to decrypt the private key
func ValidateKeyMatches(encryptedKey []byte, csrPEM *string, certPEM *string, encryptionKey []byte) KeyValidationResult {
	result := KeyValidationResult{
		KeyPresent: len(encryptedKey) > 0,
	}

	// If no key is present, return early
	if !result.KeyPresent {
		result.Error = "private key is not present in database"
		return result
	}

	// Decrypt the private key
	decryptedKeyPEM, err := DecryptPrivateKey(encryptedKey, encryptionKey)
	if err != nil {
		result.Error = fmt.Sprintf("failed to decrypt private key: %v", err)
		return result
	}

	// Parse the private key
	privateKey, err := ParsePrivateKeyFromPEM(decryptedKeyPEM)
	if err != nil {
		result.Error = fmt.Sprintf("failed to parse private key: %v", err)
		return result
	}

	// Get the public key from the private key
	privateKeyPublicKey := &privateKey.PublicKey

	// Validate against CSR if present
	if csrPEM != nil && *csrPEM != "" {
		csr, err := ParseCSR([]byte(*csrPEM))
		if err != nil {
			if result.Error != "" {
				result.Error += "; "
			}
			result.Error += fmt.Sprintf("failed to parse CSR: %v", err)
			keyMatches := false
			result.KeyMatchesCSR = &keyMatches
		} else {
			csrPubKey, ok := csr.PublicKey.(*rsa.PublicKey)
			if !ok {
				if result.Error != "" {
					result.Error += "; "
				}
				result.Error += "CSR does not contain an RSA public key"
				keyMatches := false
				result.KeyMatchesCSR = &keyMatches
			} else {
				matches := ComparePublicKeys(privateKeyPublicKey, csrPubKey)
				result.KeyMatchesCSR = &matches
				if !matches {
					if result.Error != "" {
						result.Error += "; "
					}
					result.Error += "private key does not match CSR public key"
				}
			}
		}
	}

	// Validate against certificate if present
	if certPEM != nil && *certPEM != "" {
		cert, err := ParseCertificate([]byte(*certPEM))
		if err != nil {
			if result.Error != "" {
				result.Error += "; "
			}
			result.Error += fmt.Sprintf("failed to parse certificate: %v", err)
			keyMatches := false
			result.KeyMatchesCert = &keyMatches
		} else {
			certPubKey, ok := cert.PublicKey.(*rsa.PublicKey)
			if !ok {
				if result.Error != "" {
					result.Error += "; "
				}
				result.Error += "certificate does not contain an RSA public key"
				keyMatches := false
				result.KeyMatchesCert = &keyMatches
			} else {
				matches := ComparePublicKeys(privateKeyPublicKey, certPubKey)
				result.KeyMatchesCert = &matches
				if !matches {
					if result.Error != "" {
						result.Error += "; "
					}
					result.Error += "private key does not match certificate public key"
				}
			}
		}
	}

	return result
}
