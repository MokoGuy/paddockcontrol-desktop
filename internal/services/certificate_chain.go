package services

import (
	"context"
	"fmt"

	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/models"
)

// GetCertificateChain retrieves the certificate chain for a hostname
// Returns empty chain for pending certificates (no signed cert yet)
// Fetches chain via AIA (Authority Information Access) from the leaf certificate
func (s *CertificateService) GetCertificateChain(ctx context.Context, hostname string) ([]models.ChainCertificateInfo, error) {
	// Get certificate from database
	dbCert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return nil, fmt.Errorf("certificate not found: %w", err)
	}

	// No chain for pending certificates (no signed cert)
	if !dbCert.CertificatePem.Valid || dbCert.CertificatePem.String == "" {
		return []models.ChainCertificateInfo{}, nil
	}

	// Parse the leaf certificate
	leafCert, err := crypto.ParseCertificate([]byte(dbCert.CertificatePem.String))
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificate: %w", err)
	}

	// Build chain info from leaf (includes AIA fetching)
	chainInfo, err := crypto.BuildChainInfoFromLeaf(leafCert)
	if err != nil {
		// Return partial chain (at minimum the leaf) even if AIA fetch fails
		return chainInfo, nil
	}

	return chainInfo, nil
}

// GetChainPEMForDownload returns the full certificate chain as concatenated PEM
// Chain order: leaf + intermediates + root
func (s *CertificateService) GetChainPEMForDownload(ctx context.Context, hostname string) (string, error) {
	dbCert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return "", fmt.Errorf("certificate not found: %w", err)
	}

	if !dbCert.CertificatePem.Valid || dbCert.CertificatePem.String == "" {
		return "", fmt.Errorf("no certificate for hostname: %s", hostname)
	}

	leafCert, err := crypto.ParseCertificate([]byte(dbCert.CertificatePem.String))
	if err != nil {
		return "", fmt.Errorf("failed to parse certificate: %w", err)
	}

	// Build chain from AIA
	chain, err := crypto.BuildChainFromAIA(leafCert)
	if err != nil {
		// Return just the leaf cert if chain building fails
		return dbCert.CertificatePem.String, nil
	}

	// Concatenate: leaf + chain (intermediates + root)
	result := dbCert.CertificatePem.String
	chainPEMs := crypto.ConvertChainToPEM(chain)
	for _, pem := range chainPEMs {
		result += "\n" + pem
	}

	return result, nil
}
