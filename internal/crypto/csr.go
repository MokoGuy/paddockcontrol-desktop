package crypto

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"net"
)

// CSRRequest represents the data needed to create a CSR
type CSRRequest struct {
	CommonName         string
	Organization       string
	OrganizationalUnit string
	City               string
	State              string
	Country            string
	DNSSANs            []string // DNS Subject Alternative Names
	IPSANs             []net.IP // IP Address Subject Alternative Names
}

// CreateCSR creates a new Certificate Signing Request
func CreateCSR(req CSRRequest, privateKey *rsa.PrivateKey) ([]byte, error) {
	// Create subject
	subject := pkix.Name{
		CommonName:   req.CommonName,
		Organization: []string{req.Organization},
		Locality:     []string{req.City},
		Province:     []string{req.State},
		Country:      []string{req.Country},
	}

	if req.OrganizationalUnit != "" {
		subject.OrganizationalUnit = []string{req.OrganizationalUnit}
	}

	// Create CSR template
	template := x509.CertificateRequest{
		Subject:            subject,
		SignatureAlgorithm: x509.SHA256WithRSA,
		DNSNames:           req.DNSSANs,
		IPAddresses:        req.IPSANs,
	}

	// Create CSR
	csrDER, err := x509.CreateCertificateRequest(rand.Reader, &template, privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create CSR: %w", err)
	}

	// Encode to PEM
	csrPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE REQUEST",
		Bytes: csrDER,
	})

	return csrPEM, nil
}

// ParseCSR parses a CSR from PEM format
func ParseCSR(csrPEM []byte) (*x509.CertificateRequest, error) {
	block, _ := pem.Decode(csrPEM)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	if block.Type != "CERTIFICATE REQUEST" {
		return nil, fmt.Errorf("invalid PEM type: %s", block.Type)
	}

	csr, err := x509.ParseCertificateRequest(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse CSR: %w", err)
	}

	return csr, nil
}

// ParseCertificate parses a certificate from PEM format
func ParseCertificate(certPEM []byte) (*x509.Certificate, error) {
	block, _ := pem.Decode(certPEM)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	if block.Type != "CERTIFICATE" {
		return nil, fmt.Errorf("invalid PEM type: %s", block.Type)
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificate: %w", err)
	}

	return cert, nil
}

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

// CertificateToPEM converts a certificate to PEM format
func CertificateToPEM(cert *x509.Certificate) []byte {
	return pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: cert.Raw,
	})
}

// ParseMultipleCertificates parses multiple certificates from concatenated PEM data
func ParseMultipleCertificates(pemData []byte) ([]*x509.Certificate, error) {
	var certs []*x509.Certificate
	rest := pemData

	for {
		block, remainder := pem.Decode(rest)
		if block == nil {
			break
		}

		if block.Type != "CERTIFICATE" {
			rest = remainder
			continue
		}

		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse certificate: %w", err)
		}

		certs = append(certs, cert)
		rest = remainder
	}

	if len(certs) == 0 {
		return nil, fmt.Errorf("no certificates found in PEM data")
	}

	return certs, nil
}

// ChainToPEM converts a certificate chain to concatenated PEM format
func ChainToPEM(certs []*x509.Certificate) []byte {
	var buf bytes.Buffer
	for _, cert := range certs {
		pem.Encode(&buf, &pem.Block{
			Type:  "CERTIFICATE",
			Bytes: cert.Raw,
		})
	}
	return buf.Bytes()
}

// CertificateDetails represents extracted information from a certificate
type CertificateDetails struct {
	Hostname           string
	SANs               []string // All SANs as strings (DNS names and IP addresses)
	Organization       string
	OrganizationalUnit string
	City               string
	State              string
	Country            string
	KeySize            int
}

// combineAllSANs combines DNS names and IP addresses into a single string slice
func combineAllSANs(dnsNames []string, ipAddresses []net.IP) []string {
	allSANs := make([]string, 0, len(dnsNames)+len(ipAddresses))
	allSANs = append(allSANs, dnsNames...)
	for _, ip := range ipAddresses {
		allSANs = append(allSANs, ip.String())
	}
	return allSANs
}

// ExtractCertificateDetails extracts all relevant details from a parsed certificate
func ExtractCertificateDetails(cert *x509.Certificate) (*CertificateDetails, error) {
	details := &CertificateDetails{
		Hostname: cert.Subject.CommonName,
		SANs:     combineAllSANs(cert.DNSNames, cert.IPAddresses),
	}

	// Extract organization details (take first element from arrays)
	if len(cert.Subject.Organization) > 0 {
		details.Organization = cert.Subject.Organization[0]
	}
	if len(cert.Subject.OrganizationalUnit) > 0 {
		details.OrganizationalUnit = cert.Subject.OrganizationalUnit[0]
	}
	if len(cert.Subject.Locality) > 0 {
		details.City = cert.Subject.Locality[0]
	}
	if len(cert.Subject.Province) > 0 {
		details.State = cert.Subject.Province[0]
	}
	if len(cert.Subject.Country) > 0 {
		details.Country = cert.Subject.Country[0]
	}

	// Extract key size
	if pubKey, ok := cert.PublicKey.(*rsa.PublicKey); ok {
		details.KeySize = pubKey.N.BitLen()
	} else {
		// Default to 4096 for non-RSA keys (ECC, etc.)
		details.KeySize = 4096
	}

	// Validate required fields
	if details.Hostname == "" {
		return nil, fmt.Errorf("certificate has no Common Name")
	}

	return details, nil
}

// ExtractCSRDetails extracts all relevant details from a parsed CSR
func ExtractCSRDetails(csr *x509.CertificateRequest) (*CertificateDetails, error) {
	details := &CertificateDetails{
		Hostname: csr.Subject.CommonName,
		SANs:     combineAllSANs(csr.DNSNames, csr.IPAddresses),
	}

	// Extract organization details (take first element from arrays)
	if len(csr.Subject.Organization) > 0 {
		details.Organization = csr.Subject.Organization[0]
	}
	if len(csr.Subject.OrganizationalUnit) > 0 {
		details.OrganizationalUnit = csr.Subject.OrganizationalUnit[0]
	}
	if len(csr.Subject.Locality) > 0 {
		details.City = csr.Subject.Locality[0]
	}
	if len(csr.Subject.Province) > 0 {
		details.State = csr.Subject.Province[0]
	}
	if len(csr.Subject.Country) > 0 {
		details.Country = csr.Subject.Country[0]
	}

	// Extract key size
	if pubKey, ok := csr.PublicKey.(*rsa.PublicKey); ok {
		details.KeySize = pubKey.N.BitLen()
	} else {
		// Default to 4096 for non-RSA keys (ECC, etc.)
		details.KeySize = 4096
	}

	// Validate required fields
	if details.Hostname == "" {
		return nil, fmt.Errorf("CSR has no Common Name")
	}

	return details, nil
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
func ValidateKeyMatches(encryptedKey []byte, csrPEM *string, certPEM *string, encryptionKey string) KeyValidationResult {
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
