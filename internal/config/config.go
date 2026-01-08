package config

import (
	"context"
	"database/sql"
	"fmt"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
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
	cfg, err := s.db.Queries().GetConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}
	return &cfg, nil
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
	})
}

// IsConfigured checks if initial setup is complete
func (s *Service) IsConfigured(ctx context.Context) (bool, error) {
	configured, err := s.db.Queries().IsConfigured(ctx)
	if err != nil {
		// On first run, config table is empty - this is not an error
		if err.Error() == "sql: no rows in result set" {
			return false, nil
		}
		return false, fmt.Errorf("failed to check if configured: %w", err)
	}
	return configured == 1, nil
}

// SetConfigured marks setup as complete in database
func (s *Service) SetConfigured(ctx context.Context) error {
	return s.db.Queries().SetConfigured(ctx)
}

// UpdateConfig updates configuration in database
func (s *Service) UpdateConfig(ctx context.Context, req *models.UpdateConfigRequest) (*models.Config, error) {
	// Convert UpdateConfigRequest to UpdateConfigParams
	params := sqlc.UpdateConfigParams{
		OwnerEmail:          req.OwnerEmail,
		CaName:              req.CAName,
		HostnameSuffix:      req.HostnameSuffix,
		ValidityPeriodDays:  int64(req.ValidityPeriodDays),
		DefaultOrganization: req.DefaultOrganization,
		DefaultOrganizationalUnit: sql.NullString{
			String: req.DefaultOrganizationalUnit,
			Valid:  req.DefaultOrganizationalUnit != "",
		},
		DefaultCity:    req.DefaultCity,
		DefaultState:   req.DefaultState,
		DefaultCountry: req.DefaultCountry,
		DefaultKeySize: int64(req.DefaultKeySize),
	}

	// Update configuration
	err := s.db.Queries().UpdateConfig(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to update config: %w", err)
	}

	// Fetch and return updated config
	cfg, err := s.db.Queries().GetConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch updated config: %w", err)
	}

	// Convert sqlc.Config to models.Config
	return convertSqlcToModelsConfig(&cfg), nil
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

// convertSqlcToModelsConfig converts sqlc.Config to models.Config
func convertSqlcToModelsConfig(cfg *sqlc.Config) *models.Config {
	return &models.Config{
		ID:                        int(cfg.ID),
		OwnerEmail:                cfg.OwnerEmail,
		CAName:                    cfg.CaName,
		HostnameSuffix:            cfg.HostnameSuffix,
		ValidityPeriodDays:        int(cfg.ValidityPeriodDays),
		DefaultOrganization:       cfg.DefaultOrganization,
		DefaultOrganizationalUnit: cfg.DefaultOrganizationalUnit.String,
		DefaultCity:               cfg.DefaultCity,
		DefaultState:              cfg.DefaultState,
		DefaultCountry:            cfg.DefaultCountry,
		DefaultKeySize:            int(cfg.DefaultKeySize),
		IsConfigured:              int(cfg.IsConfigured),
		CreatedAt:                 cfg.CreatedAt,
		LastModified:              cfg.LastModified,
	}
}
