package services

import (
	"context"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/models"
)

// CertificateService handles certificate operations
type CertificateService struct {
	db      *db.Database
	config  *config.Service
	history *HistoryService
}

// NewCertificateService creates a new certificate service
func NewCertificateService(database *db.Database, configSvc *config.Service) *CertificateService {
	return &CertificateService{
		db:      database,
		config:  configSvc,
		history: NewHistoryService(database),
	}
}

// GetHistory returns the activity history for a certificate
func (s *CertificateService) GetHistory(ctx context.Context, hostname string, limit int) ([]models.HistoryEntry, error) {
	return s.history.GetHistory(ctx, hostname, limit)
}
