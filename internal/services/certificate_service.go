package services

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strings"
	"time"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
)

// CertificateService handles certificate operations
type CertificateService struct {
	db     *db.Database
	config *config.Service
}

// NewCertificateService creates a new certificate service
func NewCertificateService(database *db.Database, configSvc *config.Service) *CertificateService {
	return &CertificateService{
		db:     database,
		config: configSvc,
	}
}

// GenerateCSR generates a new Certificate Signing Request
func (s *CertificateService) GenerateCSR(ctx context.Context, req models.CSRRequest, encryptionKey []byte) (*models.CSRResponse, error) {
	// Validate hostname
	if err := s.validateHostname(ctx, req.Hostname); err != nil {
		return nil, err
	}

	// Check for duplicates
	exists, err := s.db.Queries().CertificateExists(ctx, req.Hostname)
	if err != nil {
		return nil, fmt.Errorf("failed to check certificate existence: %w", err)
	}
	if exists == 1 && !req.IsRenewal {
		return nil, fmt.Errorf("certificate already exists for hostname: %s", req.Hostname)
	}

	// Generate RSA key pair
	privateKey, err := crypto.GenerateRSAKey(req.KeySize)
	if err != nil {
		return nil, fmt.Errorf("failed to generate RSA key: %w", err)
	}

	// Convert CSRRequest to crypto.CSRRequest
	csrReq := crypto.CSRRequest{
		CommonName:         req.Hostname,
		Organization:       req.Organization,
		OrganizationalUnit: req.OrganizationalUnit,
		City:               req.City,
		State:              req.State,
		Country:            req.Country,
		SANs:               req.SANs,
	}

	// Create CSR
	csrPEM, err := crypto.CreateCSR(csrReq, privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create CSR: %w", err)
	}

	// Convert private key to PEM
	keyPEM, err := crypto.PrivateKeyToPEM(privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to encode private key: %w", err)
	}

	// Encrypt private key
	encryptedKey, err := crypto.EncryptPrivateKey(keyPEM, string(encryptionKey))
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt private key: %w", err)
	}

	// Store in database
	if req.IsRenewal {
		// Update existing certificate with pending renewal
		err = s.db.Queries().UpdatePendingCSR(ctx, sqlc.UpdatePendingCSRParams{
			Hostname:                   req.Hostname,
			PendingCsrPem:              sql.NullString{String: string(csrPEM), Valid: true},
			PendingEncryptedPrivateKey: encryptedKey,
			PendingNote:                sql.NullString{String: req.Note, Valid: req.Note != ""},
		})
	} else {
		// Create new certificate record
		err = s.db.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
			Hostname:            req.Hostname,
			EncryptedPrivateKey: encryptedKey,
			PendingCsrPem:       sql.NullString{String: string(csrPEM), Valid: true},
			Note:                sql.NullString{String: req.Note, Valid: req.Note != ""},
			ReadOnly:            0,
		})
	}

	if err != nil {
		return nil, fmt.Errorf("failed to store CSR: %w", err)
	}

	return &models.CSRResponse{
		Hostname: req.Hostname,
		CSR:      string(csrPEM),
		Message:  "CSR generated successfully",
	}, nil
}

// UploadCertificate uploads and activates a signed certificate
func (s *CertificateService) UploadCertificate(ctx context.Context, hostname, certPEM string) error {
	// Get pending certificate
	cert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return fmt.Errorf("failed to get certificate: %w", err)
	}

	// Verify has pending CSR
	if !cert.PendingCsrPem.Valid || cert.PendingCsrPem.String == "" {
		return fmt.Errorf("no pending CSR for hostname: %s", hostname)
	}

	// Parse certificate and CSR to validate match
	parsedCert, err := crypto.ParseCertificate([]byte(certPEM))
	if err != nil {
		return fmt.Errorf("invalid certificate: %w", err)
	}

	parsedCSR, err := crypto.ParseCSR([]byte(cert.PendingCsrPem.String))
	if err != nil {
		return fmt.Errorf("invalid pending CSR: %w", err)
	}

	// Validate certificate matches CSR
	if err := crypto.ValidateCSRMatch(parsedCSR, parsedCert); err != nil {
		return fmt.Errorf("certificate does not match CSR: %w", err)
	}

	// Extract expiration date
	expiresAt := parsedCert.NotAfter.Unix()

	// Update in database
	err = s.db.Queries().ActivateCertificate(ctx, sqlc.ActivateCertificateParams{
		Hostname:       hostname,
		CertificatePem: sql.NullString{String: certPEM, Valid: true},
		ExpiresAt:      sql.NullInt64{Int64: expiresAt, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to activate certificate: %w", err)
	}

	return nil
}

// ImportCertificate imports a certificate with its private key
func (s *CertificateService) ImportCertificate(ctx context.Context, req models.ImportRequest, encryptionKey []byte) error {
	// Validate cert and key match
	if err := crypto.ValidateCertificateAndKey(req.CertificatePEM, req.PrivateKeyPEM); err != nil {
		return fmt.Errorf("certificate and key validation failed: %w", err)
	}

	// Parse certificate to extract metadata
	parsedCert, err := crypto.ParseCertificate([]byte(req.CertificatePEM))
	if err != nil {
		return fmt.Errorf("invalid certificate: %w", err)
	}

	// Extract hostname from certificate CN
	hostname := parsedCert.Subject.CommonName
	if hostname == "" {
		return fmt.Errorf("certificate has no common name")
	}

	// Parse private key
	privateKey, err := crypto.ParsePrivateKeyFromPEM([]byte(req.PrivateKeyPEM))
	if err != nil {
		return fmt.Errorf("invalid private key: %w", err)
	}

	// Convert to PEM if needed
	keyPEM, err := crypto.PrivateKeyToPEM(privateKey)
	if err != nil {
		return fmt.Errorf("failed to encode private key: %w", err)
	}

	// Encrypt private key
	encryptedKey, err := crypto.EncryptPrivateKey(keyPEM, string(encryptionKey))
	if err != nil {
		return fmt.Errorf("failed to encrypt private key: %w", err)
	}

	// Check for duplicates
	exists, err := s.db.Queries().CertificateExists(ctx, hostname)
	if err != nil {
		return fmt.Errorf("failed to check certificate existence: %w", err)
	}
	if exists == 1 {
		return fmt.Errorf("certificate already exists for hostname: %s", hostname)
	}

	// Extract expiration date
	expiresAt := parsedCert.NotAfter.Unix()

	// Store in database
	err = s.db.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:            hostname,
		EncryptedPrivateKey: encryptedKey,
		CertificatePem:      sql.NullString{String: req.CertificatePEM, Valid: true},
		ExpiresAt:           sql.NullInt64{Int64: expiresAt, Valid: true},
		Note:                sql.NullString{String: req.Note, Valid: req.Note != ""},
		ReadOnly:            0,
	})
	if err != nil {
		return fmt.Errorf("failed to import certificate: %w", err)
	}

	return nil
}

// ListCertificates returns a filtered and sorted list of certificates
func (s *CertificateService) ListCertificates(ctx context.Context, filter models.CertificateFilter) ([]*models.CertificateListItem, error) {
	// Get all certificates from DB
	certs, err := s.db.Queries().ListAllCertificates(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list certificates: %w", err)
	}

	// Convert to list items with computed fields
	items := make([]*models.CertificateListItem, 0, len(certs))
	for i := range certs {
		// Compute status
		status := db.ComputeStatus(&certs[i])

		// Filter by status if specified
		if filter.Status != "" && filter.Status != "all" {
			if string(status) != filter.Status {
				continue
			}
		}

		item := s.toCertificateListItem(&certs[i], status)
		items = append(items, item)
	}

	// Apply sorting
	s.sortCertificates(items, filter.SortBy, filter.SortOrder)

	return items, nil
}

// GetCertificate returns detailed certificate information
func (s *CertificateService) GetCertificate(ctx context.Context, hostname string) (*models.Certificate, error) {
	dbCert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return nil, fmt.Errorf("failed to get certificate: %w", err)
	}

	// Compute status
	status := db.ComputeStatus(&dbCert)

	// Build expires_at pointer
	var expiresAt *int64
	if dbCert.ExpiresAt.Valid {
		expiresAt = &dbCert.ExpiresAt.Int64
	}

	cert := &models.Certificate{
		Hostname:       dbCert.Hostname,
		PendingCSR:     dbCert.PendingCsrPem.String,
		CertificatePEM: dbCert.CertificatePem.String,
		CreatedAt:      dbCert.CreatedAt,
		ExpiresAt:      expiresAt,
		Status:         string(status),
		Note:           dbCert.Note.String,
		PendingNote:    dbCert.PendingNote.String,
		ReadOnly:       dbCert.ReadOnly > 0,
	}

	// Parse and add computed fields from certificate
	if cert.CertificatePEM != "" {
		certInfo, err := crypto.ParseCertificate([]byte(cert.CertificatePEM))
		if err == nil {
			details, _ := crypto.ExtractCertificateDetails(certInfo)
			if details != nil {
				cert.SANs = details.SANs
				cert.Organization = details.Organization
				cert.City = details.City
				cert.State = details.State
				cert.Country = details.Country
				cert.KeySize = details.KeySize
			}
			if expiresAt != nil {
				cert.DaysUntilExpiration = s.calculateDaysUntilExpiration(*expiresAt)
			}
		}
	} else if cert.PendingCSR != "" {
		// Parse CSR for metadata if no cert yet
		csrInfo, err := crypto.ParseCSR([]byte(cert.PendingCSR))
		if err == nil {
			details, _ := crypto.ExtractCSRDetails(csrInfo)
			if details != nil {
				cert.SANs = details.SANs
				cert.Organization = details.Organization
				cert.City = details.City
				cert.State = details.State
				cert.Country = details.Country
				cert.KeySize = details.KeySize
			}
		}
	}

	return cert, nil
}

// DeleteCertificate deletes a certificate
func (s *CertificateService) DeleteCertificate(ctx context.Context, hostname string) error {
	// Check read-only
	cert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return fmt.Errorf("failed to get certificate: %w", err)
	}

	if cert.ReadOnly == 1 {
		return fmt.Errorf("certificate is read-only and cannot be deleted")
	}

	err = s.db.Queries().DeleteCertificate(ctx, hostname)
	if err != nil {
		return fmt.Errorf("failed to delete certificate: %w", err)
	}

	return nil
}

// GetCSRForDownload returns the CSR PEM for download
func (s *CertificateService) GetCSRForDownload(ctx context.Context, hostname string) (string, error) {
	cert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return "", fmt.Errorf("failed to get certificate: %w", err)
	}

	if !cert.PendingCsrPem.Valid || cert.PendingCsrPem.String == "" {
		return "", fmt.Errorf("no pending CSR for hostname: %s", hostname)
	}

	return cert.PendingCsrPem.String, nil
}

// GetCertificateForDownload returns the certificate PEM for download
func (s *CertificateService) GetCertificateForDownload(ctx context.Context, hostname string) (string, error) {
	cert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return "", fmt.Errorf("failed to get certificate: %w", err)
	}

	if !cert.CertificatePem.Valid || cert.CertificatePem.String == "" {
		return "", fmt.Errorf("no certificate for hostname: %s", hostname)
	}

	return cert.CertificatePem.String, nil
}

// GetPrivateKeyForDownload returns the decrypted private key PEM for download
func (s *CertificateService) GetPrivateKeyForDownload(ctx context.Context, hostname string, encryptionKey []byte) (string, error) {
	cert, err := s.db.Queries().GetCertificateByHostname(ctx, hostname)
	if err != nil {
		return "", fmt.Errorf("failed to get certificate: %w", err)
	}

	if len(cert.EncryptedPrivateKey) == 0 {
		return "", fmt.Errorf("no private key for hostname: %s", hostname)
	}

	// Decrypt private key
	decryptedKey, err := crypto.DecryptPrivateKey(cert.EncryptedPrivateKey, string(encryptionKey))
	if err != nil {
		return "", fmt.Errorf("failed to decrypt private key: %w", err)
	}

	return string(decryptedKey), nil
}

// Helper methods

func (s *CertificateService) validateHostname(ctx context.Context, hostname string) error {
	if hostname == "" {
		return fmt.Errorf("hostname cannot be empty")
	}

	cfg, err := s.config.GetConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to get configuration: %w", err)
	}

	if cfg != nil && cfg.HostnameSuffix != "" {
		if !strings.HasSuffix(hostname, cfg.HostnameSuffix) {
			return fmt.Errorf("hostname must end with %s", cfg.HostnameSuffix)
		}
	}

	return nil
}

func (s *CertificateService) calculateDaysUntilExpiration(expiresAt int64) int {
	if expiresAt == 0 {
		return 0
	}
	expiresTime := time.Unix(expiresAt, 0)
	duration := time.Until(expiresTime)
	days := int(duration.Hours() / 24)
	if days < 0 {
		return 0
	}
	return days
}

func (s *CertificateService) toCertificateListItem(cert *sqlc.Certificate, status db.CertificateStatus) *models.CertificateListItem {
	var expiresAt *int64
	if cert.ExpiresAt.Valid {
		expiresAt = &cert.ExpiresAt.Int64
	}

	item := &models.CertificateListItem{
		Hostname:  cert.Hostname,
		Status:    string(status),
		CreatedAt: cert.CreatedAt,
		ExpiresAt: expiresAt,
		ReadOnly:  cert.ReadOnly > 0,
	}

	// Parse cert/CSR for additional fields
	if cert.CertificatePem.Valid && cert.CertificatePem.String != "" {
		if certInfo, err := crypto.ParseCertificate([]byte(cert.CertificatePem.String)); err == nil {
			details, _ := crypto.ExtractCertificateDetails(certInfo)
			if details != nil {
				item.SANs = details.SANs
				item.KeySize = details.KeySize
			}
			if expiresAt != nil {
				item.DaysUntilExpiration = s.calculateDaysUntilExpiration(*expiresAt)
			}
		}
	} else if cert.PendingCsrPem.Valid && cert.PendingCsrPem.String != "" {
		if csrInfo, err := crypto.ParseCSR([]byte(cert.PendingCsrPem.String)); err == nil {
			details, _ := crypto.ExtractCSRDetails(csrInfo)
			if details != nil {
				item.SANs = details.SANs
				item.KeySize = details.KeySize
			}
		}
	}

	return item
}

func (s *CertificateService) sortCertificates(certs []*models.CertificateListItem, sortBy, sortOrder string) {
	if sortBy == "" {
		sortBy = "created"
	}
	if sortOrder == "" {
		sortOrder = "desc"
	}

	reverse := sortOrder == "desc"

	switch sortBy {
	case "expiring":
		sort.Slice(certs, func(i, j int) bool {
			iTime := int64(0)
			jTime := int64(0)
			if certs[i].ExpiresAt != nil {
				iTime = *certs[i].ExpiresAt
			}
			if certs[j].ExpiresAt != nil {
				jTime = *certs[j].ExpiresAt
			}
			if reverse {
				return iTime > jTime
			}
			return iTime < jTime
		})
	case "hostname":
		sort.Slice(certs, func(i, j int) bool {
			if reverse {
				return certs[i].Hostname > certs[j].Hostname
			}
			return certs[i].Hostname < certs[j].Hostname
		})
	case "created":
		fallthrough
	default:
		sort.Slice(certs, func(i, j int) bool {
			if reverse {
				return certs[i].CreatedAt > certs[j].CreatedAt
			}
			return certs[i].CreatedAt < certs[j].CreatedAt
		})
	}
}
