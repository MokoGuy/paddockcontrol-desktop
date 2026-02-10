package services

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"

	selfupdate "github.com/creativeprojects/go-selfupdate"
)

const (
	githubOwner = "MokoGuy"
	githubRepo  = "paddockcontrol-desktop"
	cacheTTL    = 1 * time.Hour
)

// UpdateService handles checking for and applying application updates
type UpdateService struct {
	currentVersion string
	db             *db.Database
	log            *slog.Logger

	mu          sync.RWMutex
	cachedInfo  *models.UpdateInfo
	cachedAt    time.Time
	cachedRel   *selfupdate.Release
	updater     *selfupdate.Updater
}

// NewUpdateService creates a new update service
func NewUpdateService(currentVersion string, database *db.Database) *UpdateService {
	return &UpdateService{
		currentVersion: currentVersion,
		db:             database,
		log:            logger.WithComponent("update"),
	}
}

// initUpdater lazily initialises the selfupdate.Updater
func (s *UpdateService) initUpdater() (*selfupdate.Updater, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.updater != nil {
		return s.updater, nil
	}

	source, err := selfupdate.NewGitHubSource(selfupdate.GitHubConfig{})
	if err != nil {
		return nil, fmt.Errorf("failed to create GitHub source: %w", err)
	}

	updater, err := selfupdate.NewUpdater(selfupdate.Config{
		Source: source,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create updater: %w", err)
	}

	s.updater = updater
	return s.updater, nil
}

// CheckForUpdate checks GitHub for a newer release.
// If force is false, a cached result is returned when the last check was within cacheTTL.
func (s *UpdateService) CheckForUpdate(ctx context.Context, force bool) (*models.UpdateInfo, error) {
	if s.currentVersion == "dev" {
		return &models.UpdateInfo{
			CurrentVersion:  s.currentVersion,
			LatestVersion:   s.currentVersion,
			UpdateAvailable: false,
		}, nil
	}

	// Return cached result if fresh enough
	if !force {
		s.mu.RLock()
		if s.cachedInfo != nil && time.Since(s.cachedAt) < cacheTTL {
			info := *s.cachedInfo
			s.mu.RUnlock()
			return &info, nil
		}
		s.mu.RUnlock()
	}

	updater, err := s.initUpdater()
	if err != nil {
		return nil, err
	}

	s.log.Info("checking for updates",
		slog.String("current_version", s.currentVersion),
		slog.Bool("force", force),
	)

	release, found, err := updater.DetectLatest(ctx, selfupdate.ParseSlug(githubOwner+"/"+githubRepo))
	if err != nil {
		return nil, fmt.Errorf("failed to check for updates: %w", err)
	}

	info := &models.UpdateInfo{
		CurrentVersion:  s.currentVersion,
		UpdateAvailable: false,
	}

	if found && release != nil {
		info.LatestVersion = release.Version()
		info.ReleaseURL = release.URL
		info.ReleaseNotes = release.ReleaseNotes
		info.PublishedAt = release.PublishedAt.Format(time.RFC3339)
		info.AssetSize = int64(release.AssetByteSize)
		info.UpdateAvailable = release.GreaterThan(s.currentVersion)
	} else {
		info.LatestVersion = s.currentVersion
	}

	s.log.Info("update check complete",
		slog.String("latest", info.LatestVersion),
		slog.Bool("available", info.UpdateAvailable),
	)

	// Cache the result
	s.mu.Lock()
	s.cachedInfo = info
	s.cachedAt = time.Now()
	if found && release != nil {
		s.cachedRel = release
	}
	s.mu.Unlock()

	return info, nil
}

// ApplyUpdate downloads and applies the cached latest release.
// It records the outcome in the update_history table.
func (s *UpdateService) ApplyUpdate(ctx context.Context) error {
	s.mu.RLock()
	rel := s.cachedRel
	info := s.cachedInfo
	s.mu.RUnlock()

	if rel == nil || info == nil || !info.UpdateAvailable {
		return fmt.Errorf("no update available to apply")
	}

	updater, err := s.initUpdater()
	if err != nil {
		return err
	}

	toVersion := rel.Version()
	s.log.Info("applying update",
		slog.String("from", s.currentVersion),
		slog.String("to", toVersion),
	)

	exePath, err := selfupdate.ExecutablePath()
	if err != nil {
		s.recordUpdate(ctx, s.currentVersion, toVersion, "failed", err.Error())
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	if err := updater.UpdateTo(ctx, rel, exePath); err != nil {
		s.recordUpdate(ctx, s.currentVersion, toVersion, "failed", err.Error())
		return fmt.Errorf("failed to apply update: %w", err)
	}

	s.recordUpdate(ctx, s.currentVersion, toVersion, "success", "")
	s.log.Info("update applied successfully", slog.String("to", toVersion))
	return nil
}

// GetUpdateHistory returns past update records
func (s *UpdateService) GetUpdateHistory(ctx context.Context, limit int) ([]models.UpdateHistoryEntry, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := s.db.Queries().GetUpdateHistory(ctx, int64(limit))
	if err != nil {
		return nil, fmt.Errorf("failed to get update history: %w", err)
	}

	entries := make([]models.UpdateHistoryEntry, len(rows))
	for i, r := range rows {
		entries[i] = models.UpdateHistoryEntry{
			ID:          r.ID,
			FromVersion: r.FromVersion,
			ToVersion:   r.ToVersion,
			Status:      r.Status,
			CreatedAt:   r.CreatedAt,
		}
		if r.ErrorMessage.Valid {
			entries[i].ErrorMessage = r.ErrorMessage.String
		}
	}

	return entries, nil
}

// recordUpdate writes an entry to the update_history table (best-effort, errors only logged)
func (s *UpdateService) recordUpdate(ctx context.Context, from, to, status, errMsg string) {
	var nullErr sql.NullString
	if errMsg != "" {
		nullErr = sql.NullString{String: errMsg, Valid: true}
	}

	if err := s.db.Queries().RecordUpdate(ctx, sqlc.RecordUpdateParams{
		FromVersion:  from,
		ToVersion:    to,
		Status:       status,
		ErrorMessage: nullErr,
	}); err != nil {
		s.log.Error("failed to record update history",
			slog.String("from", from),
			slog.String("to", to),
			slog.String("status", status),
			logger.Err(err),
		)
	}
}
