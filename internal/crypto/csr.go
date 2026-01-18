package crypto

import (
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
