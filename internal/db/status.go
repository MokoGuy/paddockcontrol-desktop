package db

import (
	"time"

	"paddockcontrol-desktop/internal/db/sqlc"
)

// CertificateStatus represents the computed status of a certificate
type CertificateStatus string

const (
	StatusPending  CertificateStatus = "pending"
	StatusActive   CertificateStatus = "active"
	StatusExpiring CertificateStatus = "expiring"
	StatusExpired  CertificateStatus = "expired"
)

// ComputeStatus determines the certificate status based on its data
// Status is computed dynamically, not stored in the database
func ComputeStatus(cert *sqlc.Certificate) CertificateStatus {
	// If certificate PEM exists, compute status based on expiration
	if cert.CertificatePem.Valid && cert.CertificatePem.String != "" {
		if !cert.ExpiresAt.Valid {
			// Certificate exists but no expiration date
			return StatusActive
		}

		expiresTime := time.Unix(cert.ExpiresAt.Int64, 0)
		now := time.Now()

		// Check if expired
		if now.After(expiresTime) {
			return StatusExpired
		}

		// Check if expiring soon (within 30 days)
		daysUntilExpiration := int(time.Until(expiresTime).Hours() / 24)
		if daysUntilExpiration <= 30 {
			return StatusExpiring
		}

		// Certificate is active
		return StatusActive
	}

	// If only pending CSR exists, status is pending
	if cert.PendingCsrPem.Valid && cert.PendingCsrPem.String != "" {
		return StatusPending
	}

	// Default to pending if nothing is set
	return StatusPending
}

// DaysUntilExpiration calculates the number of days until a certificate expires
// Returns 0 if already expired or no expiration date
func DaysUntilExpiration(expiresAt int64) int {
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
