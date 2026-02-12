package main

import (
	"fmt"
	"log/slog"

	"paddockcontrol-desktop/internal/config"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"
)

// ============================================================================
// Setup Operations
// ============================================================================

// IsSetupComplete returns true if initial setup is complete
func (a *App) IsSetupComplete() (bool, error) {
	a.mu.RLock()
	setupService := a.setupService
	isConfigured := a.isConfigured
	a.mu.RUnlock()

	// During startup, before encryption key provided
	if setupService == nil {
		return isConfigured, nil
	}

	return setupService.IsConfigured(a.ctx)
}

// SaveSetup creates new configuration from scratch
func (a *App) SaveSetup(req models.SetupRequest) error {
	// No encryption key required - just saving CA configuration
	_, log := logger.WithOperation(a.ctx, "save_setup")
	log.Info("saving setup configuration",
		slog.String("owner_email", req.OwnerEmail),
		slog.String("ca_name", req.CAName),
	)

	a.mu.RLock()
	setupService := a.setupService
	a.mu.RUnlock()

	if setupService == nil {
		return fmt.Errorf("setup service not initialized")
	}

	if err := setupService.SetupFromScratch(a.ctx, req); err != nil {
		log.Error("setup from scratch failed", logger.Err(err))
		return err
	}

	a.mu.Lock()
	a.isConfigured = true
	a.mu.Unlock()

	log.Info("setup completed successfully")
	return nil
}

// GetSetupDefaults returns default values for setup form
func (a *App) GetSetupDefaults() *models.SetupDefaults {
	a.mu.RLock()
	setupService := a.setupService
	a.mu.RUnlock()

	if setupService == nil {
		return &models.SetupDefaults{
			ValidityPeriodDays: 365,
			DefaultKeySize:     4096,
			DefaultCountry:     "FR",
		}
	}
	return setupService.GetSetupDefaults()
}

// GetConfig returns the current configuration
func (a *App) GetConfig() (*models.Config, error) {
	log := logger.WithComponent("app")
	log.Debug("getting configuration")

	a.mu.RLock()
	configService := a.configService
	a.mu.RUnlock()

	if configService == nil {
		return nil, fmt.Errorf("config service not initialized")
	}

	cfg, err := configService.GetConfig(a.ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}

	// Convert sqlc.Config to models.Config
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
	}, nil
}

// UpdateConfig updates the application configuration
func (a *App) UpdateConfig(req models.UpdateConfigRequest) (*models.Config, error) {
	_, log := logger.WithOperation(a.ctx, "update_config")
	log.Info("updating configuration",
		slog.String("owner_email", req.OwnerEmail),
		slog.String("ca_name", req.CAName),
	)

	// Validate request
	if err := config.ValidateConfigUpdate(&req); err != nil {
		log.Error("config validation failed", logger.Err(err))
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	a.mu.RLock()
	configService := a.configService
	a.mu.RUnlock()

	if configService == nil {
		return nil, fmt.Errorf("config service not initialized")
	}

	// Update configuration
	updatedConfig, err := configService.UpdateConfig(a.ctx, &req)
	if err != nil {
		log.Error("failed to update config", logger.Err(err))
		return nil, fmt.Errorf("failed to update config: %w", err)
	}

	log.Info("configuration updated successfully")
	return updatedConfig, nil
}
