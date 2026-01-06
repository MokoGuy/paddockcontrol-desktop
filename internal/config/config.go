package config

import (
	"context"
	"fmt"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
)

// Service handles configuration management
type Service struct {
	db *db.Database
}

// NewService creates a new config service
func NewService(database *db.Database) *Service {
	return &Service{
		db: database,
	}
}

// GetConfig loads configuration from database
func (s *Service) GetConfig(ctx context.Context) (*sqlc.Config, error) {
	return s.db.Queries().GetConfig(ctx)
}

// SaveConfig updates configuration in database
func (s *Service) SaveConfig(ctx context.Context, cfg *sqlc.Config) error {
	return s.db.Queries().UpdateConfig(ctx, sqlc.UpdateConfigParams{
		OwnerEmail:                cfg.OwnerEmail,
		CaName:                    cfg.CaName,
		HostnameSuffix:            cfg.HostnameSuffix,
		DefaultOrganization:       cfg.DefaultOrganization,
		DefaultOrganizationalUnit: cfg.DefaultOrganizationalUnit,
		DefaultCity:               cfg.DefaultCity,
		DefaultState:              cfg.DefaultState,
		DefaultCountry:            cfg.DefaultCountry,
		DefaultKeySize:            cfg.DefaultKeySize,
		ValidityPeriodDays:        cfg.ValidityPeriodDays,
		IsConfigured:              cfg.IsConfigured,
	})
}

// IsConfigured checks if initial setup is complete
func (s *Service) IsConfigured(ctx context.Context) (bool, error) {
	configured, err := s.db.Queries().IsConfigured(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to check if configured: %w", err)
	}
	return configured == 1, nil
}

// SetConfigured marks setup as complete in database
func (s *Service) SetConfigured(ctx context.Context) error {
	return s.db.Queries().SetConfigured(ctx)
}

// GetDefaults returns default values for setup
func (s *Service) GetDefaults() *ConfigDefaults {
	return &ConfigDefaults{
		ValidityPeriodDays: 365,
		DefaultKeySize:     4096,
		DefaultCountry:     "FR",
	}
}

// ConfigDefaults contains default configuration values
type ConfigDefaults struct {
	ValidityPeriodDays int
	DefaultKeySize     int
	DefaultCountry     string
}
