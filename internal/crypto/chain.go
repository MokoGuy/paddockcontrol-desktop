package crypto

import (
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"paddockcontrol-desktop/internal/models"
)

// aiaCacheEntry represents a cached AIA certificate fetch result
type aiaCacheEntry struct {
	cert      *x509.Certificate
	fetchedAt time.Time
}

// aiaCache stores fetched certificates by URL with TTL
var (
	aiaCache      = make(map[string]*aiaCacheEntry)
	aiaCacheMutex sync.RWMutex
	aiaCacheTTL   = 1 * time.Hour // Cache certificates for 1 hour
)

// FetchCertificateChain fetches CA certificates from the provided URLs
// Returns PEM-encoded certificates in order
func FetchCertificateChain(urls []string) ([]string, error) {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	var chain []string

	for _, url := range urls {
		resp, err := client.Get(url)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch certificate from %s: %w", url, err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("failed to fetch certificate from %s: HTTP %d", url, resp.StatusCode)
		}

		certPEM, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read certificate from %s: %w", url, err)
		}

		// Validate it's a valid certificate
		_, err = ParseCertificate(certPEM)
		if err != nil {
			return nil, fmt.Errorf("invalid certificate from %s: %w", url, err)
		}

		chain = append(chain, string(certPEM))
	}

	return chain, nil
}

// ConstructChainBundle creates a complete certificate bundle:
// [leaf certificate] + [intermediate CAs] + [root CA]
func ConstructChainBundle(leafCertPEM string, chainPEMs []string) string {
	bundle := leafCertPEM
	for _, certPEM := range chainPEMs {
		bundle += "\n" + certPEM
	}
	return bundle
}

// ValidateChainStructure validates that certificates form a valid chain
// Since we're fetching from trusted CA URLs, we validate the chain structure
// without requiring the root to be in the system certificate store
func ValidateChainStructure(leafCertPEM string, chainPEMs []string) error {
	// Parse leaf certificate
	leafCert, err := ParseCertificate([]byte(leafCertPEM))
	if err != nil {
		return fmt.Errorf("invalid leaf certificate: %w", err)
	}

	// Parse chain certificates
	var chainCerts []*x509.Certificate
	for i, certPEM := range chainPEMs {
		cert, err := ParseCertificate([]byte(certPEM))
		if err != nil {
			return fmt.Errorf("invalid chain certificate %d: %w", i, err)
		}
		chainCerts = append(chainCerts, cert)
	}

	if len(chainCerts) == 0 {
		return fmt.Errorf("no chain certificates provided")
	}

	// Build intermediate cert pool (all except root)
	intermediates := x509.NewCertPool()
	if len(chainCerts) > 1 {
		for _, cert := range chainCerts[:len(chainCerts)-1] {
			intermediates.AddCert(cert)
		}
	}

	// Build root cert pool (last cert is root)
	roots := x509.NewCertPool()
	rootCert := chainCerts[len(chainCerts)-1]
	roots.AddCert(rootCert)

	// Verify chain using only the provided certificates
	// This validates that the chain forms a valid path without requiring
	// the root to be in the system certificate store
	opts := x509.VerifyOptions{
		Intermediates: intermediates,
		Roots:         roots,
	}

	_, err = leafCert.Verify(opts)
	if err != nil {
		return fmt.Errorf("chain verification failed: %w", err)
	}

	return nil
}

// ChainToJSON converts a certificate chain to JSON array of PEM strings
func ChainToJSON(chainPEMs []string) (string, error) {
	jsonData, err := json.Marshal(chainPEMs)
	if err != nil {
		return "", fmt.Errorf("failed to marshal chain to JSON: %w", err)
	}
	return string(jsonData), nil
}

// ChainFromJSON parses a certificate chain from JSON array
func ChainFromJSON(jsonData string) ([]string, error) {
	var chain []string
	err := json.Unmarshal([]byte(jsonData), &chain)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal chain from JSON: %w", err)
	}
	return chain, nil
}

// FetchCertificateFromAIAURL fetches a certificate from an AIA URL
// Returns the parsed certificate or an error
// Uses an in-memory cache to avoid repeated network calls for the same URL
func FetchCertificateFromAIAURL(url string) (*x509.Certificate, error) {
	// Check cache first
	aiaCacheMutex.RLock()
	if entry, ok := aiaCache[url]; ok {
		if time.Since(entry.fetchedAt) < aiaCacheTTL {
			aiaCacheMutex.RUnlock()
			return entry.cert, nil
		}
	}
	aiaCacheMutex.RUnlock()

	// Not in cache or expired, fetch from network
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch certificate from %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch certificate from %s: HTTP %d", url, resp.StatusCode)
	}

	certPEM, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read certificate from %s: %w", url, err)
	}

	// Parse and validate certificate
	cert, err := ParseCertificate(certPEM)
	if err != nil {
		return nil, fmt.Errorf("invalid certificate from %s: %w", url, err)
	}

	// Store in cache
	aiaCacheMutex.Lock()
	aiaCache[url] = &aiaCacheEntry{
		cert:      cert,
		fetchedAt: time.Now(),
	}
	aiaCacheMutex.Unlock()

	return cert, nil
}

// BuildChainFromAIA builds a certificate chain by following AIA (Authority Information Access) URLs
// Starting from the leaf certificate, it follows IssuingCertificateURL until it reaches the root
// Returns the chain in order: [intermediate1, intermediate2, ..., root]
// Returns an empty chain if the certificate is self-signed or has no AIA extension
func BuildChainFromAIA(leafCert *x509.Certificate) ([]*x509.Certificate, error) {
	var chain []*x509.Certificate
	visited := make(map[string]bool) // Track visited URLs to prevent infinite loops
	currentCert := leafCert

	for {
		// Check if current certificate has AIA extension with IssuingCertificateURL
		if len(currentCert.IssuingCertificateURL) == 0 {
			// No AIA URL - check if it's self-signed (root)
			if currentCert.Subject.String() == currentCert.Issuer.String() {
				// Self-signed root - we're done
				return chain, nil
			}
			// Not self-signed but no AIA URL - can't continue
			return chain, fmt.Errorf("certificate has no AIA IssuingCertificateURL and is not self-signed")
		}

		// Use the first AIA URL (certificates may have multiple)
		aiaURL := currentCert.IssuingCertificateURL[0]

		// Check for circular references
		if visited[aiaURL] {
			return chain, fmt.Errorf("circular reference detected in AIA chain at URL: %s", aiaURL)
		}
		visited[aiaURL] = true

		// Fetch issuer certificate from AIA URL
		issuerCert, err := FetchCertificateFromAIAURL(aiaURL)
		if err != nil {
			return chain, fmt.Errorf("failed to fetch issuer from AIA URL %s: %w", aiaURL, err)
		}

		// Validate that fetched certificate matches the issuer
		// Check if issuer's Subject matches current cert's Issuer DN
		if issuerCert.Subject.String() != currentCert.Issuer.String() {
			return chain, fmt.Errorf("issuer certificate mismatch: expected issuer %s, got %s", currentCert.Issuer.String(), issuerCert.Subject.String())
		}

		// Add issuer to chain
		chain = append(chain, issuerCert)

		// Check if issuer is self-signed (root certificate)
		if issuerCert.Subject.String() == issuerCert.Issuer.String() {
			// Found root - we're done
			return chain, nil
		}

		// Continue with issuer as next certificate
		currentCert = issuerCert
	}
}

// BuildChainFromAIAPEM builds a certificate chain from a leaf certificate PEM
// This is a convenience wrapper that parses the PEM and calls BuildChainFromAIA
func BuildChainFromAIAPEM(leafCertPEM []byte) ([]*x509.Certificate, error) {
	leafCert, err := ParseCertificate(leafCertPEM)
	if err != nil {
		return nil, fmt.Errorf("failed to parse leaf certificate: %w", err)
	}

	return BuildChainFromAIA(leafCert)
}

// ConvertChainToPEM converts a chain of certificates to PEM format
// Returns an array of PEM-encoded certificate strings
func ConvertChainToPEM(chain []*x509.Certificate) []string {
	var pemChain []string
	for _, cert := range chain {
		pemBlock := &pem.Block{
			Type:  "CERTIFICATE",
			Bytes: cert.Raw,
		}
		pemData := pem.EncodeToMemory(pemBlock)
		pemChain = append(pemChain, string(pemData))
	}
	return pemChain
}

// ExtractChainInfo extracts display metadata from a certificate
func ExtractChainInfo(cert *x509.Certificate, certType string, depth int) models.ChainCertificateInfo {
	info := models.ChainCertificateInfo{
		CertType: certType,
		Depth:    depth,
	}

	// Subject info
	info.SubjectCN = cert.Subject.CommonName
	if len(cert.Subject.Organization) > 0 {
		info.SubjectO = cert.Subject.Organization[0]
	}

	// Issuer info
	info.IssuerCN = cert.Issuer.CommonName
	if len(cert.Issuer.Organization) > 0 {
		info.IssuerO = cert.Issuer.Organization[0]
	}

	// Validity dates (as Unix timestamps for JS timezone formatting)
	info.NotBeforeTimestamp = cert.NotBefore.Unix()
	info.NotAfterTimestamp = cert.NotAfter.Unix()

	// Serial number (hex)
	info.SerialNumber = fmt.Sprintf("%X", cert.SerialNumber)

	// PEM encoding for export
	pemBlock := &pem.Block{
		Type:  "CERTIFICATE",
		Bytes: cert.Raw,
	}
	info.PEM = string(pem.EncodeToMemory(pemBlock))

	return info
}

// BuildChainInfoFromLeaf builds chain metadata for visualization
// Returns []ChainCertificateInfo with leaf at index 0, root at the end
func BuildChainInfoFromLeaf(leafCert *x509.Certificate) ([]models.ChainCertificateInfo, error) {
	var chainInfo []models.ChainCertificateInfo

	// Check if self-signed (leaf is also root)
	isSelfSigned := leafCert.Subject.String() == leafCert.Issuer.String()

	if isSelfSigned {
		// Self-signed certificate - single node marked as root
		chainInfo = append(chainInfo, ExtractChainInfo(leafCert, "root", 0))
		return chainInfo, nil
	}

	// Add leaf certificate (depth 0)
	chainInfo = append(chainInfo, ExtractChainInfo(leafCert, "leaf", 0))

	// Build chain from AIA
	chain, err := BuildChainFromAIA(leafCert)
	if err != nil {
		// Return leaf-only with error
		return chainInfo, err
	}

	// Add intermediates and root
	for i, cert := range chain {
		certType := "intermediate"
		if i == len(chain)-1 {
			certType = "root"
		}
		chainInfo = append(chainInfo, ExtractChainInfo(cert, certType, i+1))
	}

	return chainInfo, nil
}
