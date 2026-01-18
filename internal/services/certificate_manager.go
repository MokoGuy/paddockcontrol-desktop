package services

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"time"

	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
)

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
				cert.OrganizationalUnit = details.OrganizationalUnit
				cert.City = details.City
				cert.State = details.State
				cert.Country = details.Country
				cert.KeySize = details.KeySize
			}
			if expiresAt != nil {
				cert.DaysUntilExpiration = s.calculateDaysUntilExpiration(*expiresAt)
			}
		}
	}

	// Always parse pending CSR if present (for regenerate functionality)
	// When both cert and CSR exist, this populates the Pending* fields
	// When only CSR exists, this populates both main and Pending* fields
	if cert.PendingCSR != "" {
		csrInfo, err := crypto.ParseCSR([]byte(cert.PendingCSR))
		if err == nil {
			details, _ := crypto.ExtractCSRDetails(csrInfo)
			if details != nil {
				// Always set pending fields from CSR
				cert.PendingSANs = details.SANs
				cert.PendingOrganization = details.Organization
				cert.PendingOrganizationalUnit = details.OrganizationalUnit
				cert.PendingCity = details.City
				cert.PendingState = details.State
				cert.PendingCountry = details.Country
				cert.PendingKeySize = details.KeySize

				// If no certificate exists, also set main fields from CSR
				if cert.CertificatePEM == "" {
					cert.SANs = details.SANs
					cert.Organization = details.Organization
					cert.OrganizationalUnit = details.OrganizationalUnit
					cert.City = details.City
					cert.State = details.State
					cert.Country = details.Country
					cert.KeySize = details.KeySize
				}
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

// SetCertificateReadOnly sets the read-only status of a certificate
func (s *CertificateService) SetCertificateReadOnly(ctx context.Context, hostname string, readOnly bool) error {
	readOnlyValue := int64(0)
	if readOnly {
		readOnlyValue = 1
	}
	return s.db.Queries().UpdateCertificateReadOnly(ctx, sqlc.UpdateCertificateReadOnlyParams{
		ReadOnly: readOnlyValue,
		Hostname: hostname,
	})
}

// UpdateCertificateNote updates the note for a certificate
func (s *CertificateService) UpdateCertificateNote(ctx context.Context, hostname string, note string) error {
	var noteValue sql.NullString
	if note != "" {
		noteValue = sql.NullString{String: note, Valid: true}
	}
	return s.db.Queries().UpdateCertificateNote(ctx, sqlc.UpdateCertificateNoteParams{
		Note:     noteValue,
		Hostname: hostname,
	})
}

// UpdatePendingNote updates the pending note for a certificate
func (s *CertificateService) UpdatePendingNote(ctx context.Context, hostname string, note string) error {
	var noteValue sql.NullString
	if note != "" {
		noteValue = sql.NullString{String: note, Valid: true}
	}
	return s.db.Queries().UpdatePendingNote(ctx, sqlc.UpdatePendingNoteParams{
		PendingNote: noteValue,
		Hostname:    hostname,
	})
}

// toCertificateListItem converts a database certificate to a list item
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

// sortCertificates sorts certificates by the specified field
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

// calculateDaysUntilExpiration calculates the number of days until expiration
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
