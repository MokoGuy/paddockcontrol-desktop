package services

import (
	"context"
	"testing"

	"paddockcontrol-desktop/internal/models"
)

func TestSetupFromScratch_Success(t *testing.T) {
	svc, _ := setupSetupService(t)
	ctx := context.Background()

	req := makeTestSetupRequest()
	err := svc.SetupFromScratch(ctx, req)
	if err != nil {
		t.Fatalf("SetupFromScratch failed: %v", err)
	}

	configured, err := svc.IsConfigured(ctx)
	if err != nil {
		t.Fatalf("IsConfigured failed: %v", err)
	}
	if !configured {
		t.Error("expected IsConfigured to be true after setup")
	}
}

func TestSetupFromScratch_MissingOwnerEmail_ReturnsError(t *testing.T) {
	svc, _ := setupSetupService(t)
	ctx := context.Background()

	req := makeTestSetupRequest()
	req.OwnerEmail = ""

	err := svc.SetupFromScratch(ctx, req)
	if err == nil {
		t.Fatal("expected error for missing owner email, got nil")
	}
	if !containsSubstring(err.Error(), "owner email") {
		t.Errorf("expected owner email error, got: %v", err)
	}
}

func TestSetupFromScratch_MissingCAName_ReturnsError(t *testing.T) {
	svc, _ := setupSetupService(t)
	ctx := context.Background()

	req := makeTestSetupRequest()
	req.CAName = ""

	err := svc.SetupFromScratch(ctx, req)
	if err == nil {
		t.Fatal("expected error for missing CA name, got nil")
	}
	if !containsSubstring(err.Error(), "CA name") {
		t.Errorf("expected CA name error, got: %v", err)
	}
}

func TestSetupFromScratch_MissingOrganization_ReturnsError(t *testing.T) {
	svc, _ := setupSetupService(t)
	ctx := context.Background()

	req := makeTestSetupRequest()
	req.DefaultOrganization = ""

	err := svc.SetupFromScratch(ctx, req)
	if err == nil {
		t.Fatal("expected error for missing organization, got nil")
	}
	if !containsSubstring(err.Error(), "organization") {
		t.Errorf("expected organization error, got: %v", err)
	}
}

func TestSetupFromScratch_InvalidCountryCode_ReturnsError(t *testing.T) {
	svc, _ := setupSetupService(t)
	ctx := context.Background()

	req := makeTestSetupRequest()
	req.DefaultCountry = "FRA" // 3-letter, should be 2

	err := svc.SetupFromScratch(ctx, req)
	if err == nil {
		t.Fatal("expected error for invalid country code, got nil")
	}
	if !containsSubstring(err.Error(), "2-letter") {
		t.Errorf("expected 2-letter country error, got: %v", err)
	}
}

func TestSetupFromScratch_KeySizeTooSmall_ReturnsError(t *testing.T) {
	svc, _ := setupSetupService(t)
	ctx := context.Background()

	req := makeTestSetupRequest()
	req.DefaultKeySize = 1024

	err := svc.SetupFromScratch(ctx, req)
	if err == nil {
		t.Fatal("expected error for small key size, got nil")
	}
	if !containsSubstring(err.Error(), "2048") {
		t.Errorf("expected key size error, got: %v", err)
	}
}

func TestSetupFromScratch_InvalidValidityPeriod_ReturnsError(t *testing.T) {
	svc, _ := setupSetupService(t)
	ctx := context.Background()

	req := makeTestSetupRequest()
	req.ValidityPeriodDays = 0

	err := svc.SetupFromScratch(ctx, req)
	if err == nil {
		t.Fatal("expected error for invalid validity period, got nil")
	}
	if !containsSubstring(err.Error(), "at least 1 day") {
		t.Errorf("expected validity period error, got: %v", err)
	}
}

func TestSetupFromScratch_StoresAllFields(t *testing.T) {
	svc, database := setupSetupService(t)
	ctx := context.Background()

	req := models.SetupRequest{
		OwnerEmail:                "admin@test.com",
		CAName:                    "My CA",
		HostnameSuffix:            ".myorg.com",
		ValidityPeriodDays:        730,
		DefaultOrganization:       "MyOrg",
		DefaultOrganizationalUnit: "Engineering",
		DefaultCity:               "Lyon",
		DefaultState:              "Rhone",
		DefaultCountry:            "FR",
		DefaultKeySize:            4096,
	}

	err := svc.SetupFromScratch(ctx, req)
	if err != nil {
		t.Fatalf("SetupFromScratch failed: %v", err)
	}

	cfg, err := database.Queries().GetConfig(ctx)
	if err != nil {
		t.Fatalf("failed to get config: %v", err)
	}

	if cfg.OwnerEmail != "admin@test.com" {
		t.Errorf("expected owner email admin@test.com, got %s", cfg.OwnerEmail)
	}
	if cfg.CaName != "My CA" {
		t.Errorf("expected CA name 'My CA', got %s", cfg.CaName)
	}
	if cfg.HostnameSuffix != ".myorg.com" {
		t.Errorf("expected hostname suffix .myorg.com, got %s", cfg.HostnameSuffix)
	}
	if cfg.ValidityPeriodDays != 730 {
		t.Errorf("expected validity 730, got %d", cfg.ValidityPeriodDays)
	}
	if cfg.DefaultOrganization != "MyOrg" {
		t.Errorf("expected org MyOrg, got %s", cfg.DefaultOrganization)
	}
	if !cfg.DefaultOrganizationalUnit.Valid || cfg.DefaultOrganizationalUnit.String != "Engineering" {
		t.Errorf("expected OU Engineering, got %v", cfg.DefaultOrganizationalUnit)
	}
	if cfg.DefaultCity != "Lyon" {
		t.Errorf("expected city Lyon, got %s", cfg.DefaultCity)
	}
	if cfg.DefaultState != "Rhone" {
		t.Errorf("expected state Rhone, got %s", cfg.DefaultState)
	}
	if cfg.DefaultCountry != "FR" {
		t.Errorf("expected country FR, got %s", cfg.DefaultCountry)
	}
	if cfg.DefaultKeySize != 4096 {
		t.Errorf("expected key size 4096, got %d", cfg.DefaultKeySize)
	}
}

func TestGetSetupDefaults(t *testing.T) {
	svc, _ := setupSetupService(t)

	defaults := svc.GetSetupDefaults()
	if defaults == nil {
		t.Fatal("expected non-nil defaults")
	}
	if defaults.ValidityPeriodDays != 365 {
		t.Errorf("expected validity 365, got %d", defaults.ValidityPeriodDays)
	}
	if defaults.DefaultKeySize != 4096 {
		t.Errorf("expected key size 4096, got %d", defaults.DefaultKeySize)
	}
	if defaults.DefaultCountry != "FR" {
		t.Errorf("expected country FR, got %s", defaults.DefaultCountry)
	}
}

func TestIsConfigured_BeforeSetup(t *testing.T) {
	svc, _ := setupSetupService(t)
	ctx := context.Background()

	configured, err := svc.IsConfigured(ctx)
	if err != nil {
		t.Fatalf("IsConfigured failed: %v", err)
	}
	if configured {
		t.Error("expected IsConfigured to be false before setup")
	}
}

func TestIsConfigured_AfterSetup(t *testing.T) {
	svc, _ := setupSetupService(t)
	ctx := context.Background()

	req := makeTestSetupRequest()
	err := svc.SetupFromScratch(ctx, req)
	if err != nil {
		t.Fatalf("SetupFromScratch failed: %v", err)
	}

	configured, err := svc.IsConfigured(ctx)
	if err != nil {
		t.Fatalf("IsConfigured failed: %v", err)
	}
	if !configured {
		t.Error("expected IsConfigured to be true after setup")
	}
}
