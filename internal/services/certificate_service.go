package services

import (
	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/db"
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
