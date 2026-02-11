package crypto

import (
	"bytes"
	"crypto/x509"
	"encoding/pem"
	"fmt"
)

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

// CertificateToPEM converts a certificate to PEM format
func CertificateToPEM(cert *x509.Certificate) []byte {
	return pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: cert.Raw,
	})
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
