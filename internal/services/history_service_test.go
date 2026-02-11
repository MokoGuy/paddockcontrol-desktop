package services

import (
	"context"
	"testing"

	"paddockcontrol-desktop/internal/db"
	"paddockcontrol-desktop/internal/models"
)

func setupHistoryService(t *testing.T) (*HistoryService, *db.Database) {
	t.Helper()
	database, err := db.NewDatabase(":memory:")
	if err != nil {
		t.Fatalf("failed to create database: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return NewHistoryService(database), database
}

func TestLogEvent_Success(t *testing.T) {
	svc, _ := setupHistoryService(t)
	ctx := context.Background()

	err := svc.LogEvent(ctx, "test.example.com", models.EventCSRGenerated, "CSR generated")
	if err != nil {
		t.Fatalf("LogEvent failed: %v", err)
	}

	entries, err := svc.GetHistory(ctx, "test.example.com", 10)
	if err != nil {
		t.Fatalf("GetHistory failed: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	if entries[0].Hostname != "test.example.com" {
		t.Errorf("expected hostname test.example.com, got %s", entries[0].Hostname)
	}
	if entries[0].EventType != models.EventCSRGenerated {
		t.Errorf("expected event type %s, got %s", models.EventCSRGenerated, entries[0].EventType)
	}
	if entries[0].Message != "CSR generated" {
		t.Errorf("expected message 'CSR generated', got %s", entries[0].Message)
	}
}

func TestGetHistory_ReturnsEntries(t *testing.T) {
	svc, _ := setupHistoryService(t)
	ctx := context.Background()
	hostname := "test.example.com"

	// Log multiple events
	events := []struct {
		eventType string
		message   string
	}{
		{models.EventCSRGenerated, "CSR generated"},
		{models.EventCertificateUploaded, "Certificate uploaded"},
		{models.EventCSRRegenerated, "CSR regenerated"},
	}
	for _, e := range events {
		if err := svc.LogEvent(ctx, hostname, e.eventType, e.message); err != nil {
			t.Fatalf("LogEvent failed: %v", err)
		}
	}

	entries, err := svc.GetHistory(ctx, hostname, 10)
	if err != nil {
		t.Fatalf("GetHistory failed: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}
}

func TestGetHistory_DefaultLimit(t *testing.T) {
	svc, _ := setupHistoryService(t)
	ctx := context.Background()
	hostname := "test.example.com"

	// Log a few events
	for i := 0; i < 3; i++ {
		if err := svc.LogEvent(ctx, hostname, models.EventCSRGenerated, "event"); err != nil {
			t.Fatalf("LogEvent failed: %v", err)
		}
	}

	// limit <= 0 should default to 50 (but we only have 3)
	entries, err := svc.GetHistory(ctx, hostname, 0)
	if err != nil {
		t.Fatalf("GetHistory with limit=0 failed: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}

	entries, err = svc.GetHistory(ctx, hostname, -1)
	if err != nil {
		t.Fatalf("GetHistory with limit=-1 failed: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}
}

func TestGetHistory_CustomLimit(t *testing.T) {
	svc, _ := setupHistoryService(t)
	ctx := context.Background()
	hostname := "test.example.com"

	for i := 0; i < 5; i++ {
		if err := svc.LogEvent(ctx, hostname, models.EventCSRGenerated, "event"); err != nil {
			t.Fatalf("LogEvent failed: %v", err)
		}
	}

	entries, err := svc.GetHistory(ctx, hostname, 2)
	if err != nil {
		t.Fatalf("GetHistory failed: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries (limit=2), got %d", len(entries))
	}
}

func TestGetHistory_EmptyHistory(t *testing.T) {
	svc, _ := setupHistoryService(t)
	ctx := context.Background()

	entries, err := svc.GetHistory(ctx, "nonexistent.example.com", 10)
	if err != nil {
		t.Fatalf("GetHistory failed: %v", err)
	}
	if len(entries) != 0 {
		t.Fatalf("expected 0 entries for empty history, got %d", len(entries))
	}
}

func TestGetHistory_FiltersByHostname(t *testing.T) {
	svc, _ := setupHistoryService(t)
	ctx := context.Background()

	// Log events for two different hostnames
	if err := svc.LogEvent(ctx, "host1.example.com", models.EventCSRGenerated, "event 1"); err != nil {
		t.Fatalf("LogEvent failed: %v", err)
	}
	if err := svc.LogEvent(ctx, "host2.example.com", models.EventCSRGenerated, "event 2"); err != nil {
		t.Fatalf("LogEvent failed: %v", err)
	}
	if err := svc.LogEvent(ctx, "host1.example.com", models.EventCertificateUploaded, "event 3"); err != nil {
		t.Fatalf("LogEvent failed: %v", err)
	}

	entries, err := svc.GetHistory(ctx, "host1.example.com", 10)
	if err != nil {
		t.Fatalf("GetHistory failed: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries for host1, got %d", len(entries))
	}
	for _, e := range entries {
		if e.Hostname != "host1.example.com" {
			t.Errorf("expected hostname host1.example.com, got %s", e.Hostname)
		}
	}

	entries, err = svc.GetHistory(ctx, "host2.example.com", 10)
	if err != nil {
		t.Fatalf("GetHistory failed: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry for host2, got %d", len(entries))
	}
}
