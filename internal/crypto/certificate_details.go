package crypto

import (
	"crypto/rsa"
	"crypto/x509"
	"fmt"
	"net"
)

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
