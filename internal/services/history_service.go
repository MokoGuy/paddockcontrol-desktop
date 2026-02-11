package services

import (
	"context"
	"fmt"

	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
)

// HistoryService handles certificate activity history
type HistoryService struct {
	db *db.Database
}

// NewHistoryService creates a new history service
func NewHistoryService(database *db.Database) *HistoryService {
	return &HistoryService{
		db: database,
	}
}

// LogEvent adds a new history entry for a certificate
func (s *HistoryService) LogEvent(ctx context.Context, hostname, eventType, message string) error {
	return s.db.Queries().AddHistoryEntry(ctx, sqlc.AddHistoryEntryParams{
		Hostname:  hostname,
		EventType: eventType,
		Message:   message,
	})
}

// GetHistory returns the history entries for a certificate
func (s *HistoryService) GetHistory(ctx context.Context, hostname string, limit int) ([]models.HistoryEntry, error) {
	if limit <= 0 {
		limit = 50
	}

	entries, err := s.db.Queries().GetCertificateHistory(ctx, sqlc.GetCertificateHistoryParams{
		Hostname: hostname,
		Limit:    int64(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get certificate history: %w", err)
	}

	result := make([]models.HistoryEntry, len(entries))
	for i, e := range entries {
		result[i] = models.HistoryEntry{
			ID:        e.ID,
			Hostname:  e.Hostname,
			EventType: e.EventType,
			Message:   e.Message,
			CreatedAt: e.CreatedAt,
		}
	}

	return result, nil
}
