package services

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"
)

// SetupService handles initial application setup and configuration
type SetupService struct {
	db     *db.Database
	config *config.Service
	log    *slog.Logger
}

// NewSetupService creates a new setup service
func NewSetupService(database *db.Database, configSvc *config.Service) *SetupService {
	return &SetupService{
		db:     database,
		config: configSvc,
		log:    logger.WithComponent("setup"),
	}
}

// IsConfigured checks if initial setup is complete
func (s *SetupService) IsConfigured(ctx context.Context) (bool, error) {
	return s.config.IsConfigured(ctx)
}

// SetupFromScratch creates a new configuration from scratch
func (s *SetupService) SetupFromScratch(ctx context.Context, req models.SetupRequest) error {
	ctx, log := logger.WithOperation(ctx, "setup_fresh")
	log.Info("starting fresh setup",
		slog.String("owner_email", req.OwnerEmail),
		slog.String("ca_name", req.CAName),
		slog.String("hostname_suffix", req.HostnameSuffix),
	)

	// Validate setup request
	if err := s.validateSetupRequest(req); err != nil {
		log.Error("setup request validation failed", logger.Err(err))
		return err
	}
	log.Debug("setup request validated")

	// Create config record in database
	err := s.db.Queries().CreateConfig(ctx, sqlc.CreateConfigParams{
		OwnerEmail:                req.OwnerEmail,
		CaName:                    req.CAName,
		HostnameSuffix:            req.HostnameSuffix,
		DefaultOrganization:       req.DefaultOrganization,
		DefaultOrganizationalUnit: stringToNullString(req.DefaultOrganizationalUnit),
		DefaultCity:               req.DefaultCity,
		DefaultState:              req.DefaultState,
		DefaultCountry:            req.DefaultCountry,
		DefaultKeySize:            int64(req.DefaultKeySize),
		ValidityPeriodDays:        int64(req.ValidityPeriodDays),
	})
	if err != nil {
		log.Error("failed to create configuration", logger.Err(err))
		return fmt.Errorf("failed to create configuration: %w", err)
	}
	log.Debug("configuration record created")

	// Mark as configured
	err = s.config.SetConfigured(ctx)
	if err != nil {
		log.Error("failed to mark as configured", logger.Err(err))
		return fmt.Errorf("failed to mark as configured: %w", err)
	}

	log.Info("fresh setup completed successfully")
	return nil
}

// GetSetupDefaults returns default values for setup form
func (s *SetupService) GetSetupDefaults() *models.SetupDefaults {
	return &models.SetupDefaults{
		ValidityPeriodDays: 365,
		DefaultKeySize:     4096,
		DefaultCountry:     "FR",
	}
}

// Helper methods

// validateSetupRequest validates the setup request for required fields
func (s *SetupService) validateSetupRequest(req models.SetupRequest) error {
	if req.OwnerEmail == "" {
		return fmt.Errorf("owner email is required")
	}

	if req.CAName == "" {
		return fmt.Errorf("CA name is required")
	}

	if req.DefaultOrganization == "" {
		return fmt.Errorf("default organization is required")
	}

	if req.DefaultCity == "" {
		return fmt.Errorf("default city is required")
	}

	if req.DefaultState == "" {
		return fmt.Errorf("default state is required")
	}

	if req.DefaultCountry == "" {
		return fmt.Errorf("default country is required")
	}

	if len(req.DefaultCountry) != 2 {
		return fmt.Errorf("default country must be a 2-letter ISO code")
	}

	if req.DefaultKeySize < 2048 {
		return fmt.Errorf("default key size must be at least 2048 bits")
	}

	if req.ValidityPeriodDays < 1 {
		return fmt.Errorf("validity period must be at least 1 day")
	}

	return nil
}

// toNullString converts string to sql.NullString
func stringToNullString(s string) sql.NullString {
	return sql.NullString{
		String: s,
		Valid:  s != "",
	}
}
