package services

import (
	"context"
	"crypto/x509"
	"database/sql"
	"encoding/pem"
	"net"
	"strings"
	"testing"

	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/models"
	"paddockcontrol-desktop/internal/testutil"
)

func TestGenerateCSR_Success(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	req := models.CSRRequest{
		Hostname:     "server.example.com",
		Organization: "Test Org",
		City:         "Paris",
		State:        "IDF",
		Country:      "FR",
		KeySize:      2048,
	}

	resp, err := svc.GenerateCSR(ctx, req, encryptionKey)
	if err != nil {
		t.Fatalf("GenerateCSR failed: %v", err)
	}

	if resp.Hostname != "server.example.com" {
		t.Errorf("expected hostname server.example.com, got %s", resp.Hostname)
	}
	if !strings.Contains(resp.CSR, "BEGIN CERTIFICATE REQUEST") {
		t.Error("expected CSR PEM in response")
	}

	// Verify stored in DB
	cert, err := database.Queries().GetCertificateByHostname(ctx, "server.example.com")
	if err != nil {
		t.Fatalf("failed to get certificate: %v", err)
	}
	if !cert.PendingCsrPem.Valid {
		t.Error("expected pending CSR to be stored")
	}
	if len(cert.PendingEncryptedPrivateKey) == 0 {
		t.Error("expected pending encrypted private key to be stored")
	}
}

func TestGenerateCSR_VerifyCSRContent(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	req := models.CSRRequest{
		Hostname:           "server.example.com",
		Organization:       "My Org",
		OrganizationalUnit: "IT Dept",
		City:               "Lyon",
		State:              "Rhone",
		Country:            "FR",
		KeySize:            2048,
	}

	resp, err := svc.GenerateCSR(ctx, req, encryptionKey)
	if err != nil {
		t.Fatalf("GenerateCSR failed: %v", err)
	}

	// Parse the CSR
	block, _ := pem.Decode([]byte(resp.CSR))
	if block == nil {
		t.Fatal("failed to decode CSR PEM")
	}
	csr, err := x509.ParseCertificateRequest(block.Bytes)
	if err != nil {
		t.Fatalf("failed to parse CSR: %v", err)
	}

	if csr.Subject.CommonName != "server.example.com" {
		t.Errorf("expected CN server.example.com, got %s", csr.Subject.CommonName)
	}
	if len(csr.Subject.Organization) == 0 || csr.Subject.Organization[0] != "My Org" {
		t.Errorf("expected Organization 'My Org', got %v", csr.Subject.Organization)
	}
	if len(csr.Subject.OrganizationalUnit) == 0 || csr.Subject.OrganizationalUnit[0] != "IT Dept" {
		t.Errorf("expected OU 'IT Dept', got %v", csr.Subject.OrganizationalUnit)
	}
}

func TestGenerateCSR_WithDNSSANs(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	req := models.CSRRequest{
		Hostname:     "server.example.com",
		Organization: "Test Org",
		City:         "Paris",
		State:        "IDF",
		Country:      "FR",
		KeySize:      2048,
		SANs: []models.SANEntry{
			{Value: "alias1.example.com", Type: models.SANTypeDNS},
			{Value: "alias2.example.com", Type: models.SANTypeDNS},
		},
	}

	resp, err := svc.GenerateCSR(ctx, req, encryptionKey)
	if err != nil {
		t.Fatalf("GenerateCSR failed: %v", err)
	}

	block, _ := pem.Decode([]byte(resp.CSR))
	csr, err := x509.ParseCertificateRequest(block.Bytes)
	if err != nil {
		t.Fatalf("failed to parse CSR: %v", err)
	}

	if len(csr.DNSNames) != 2 {
		t.Fatalf("expected 2 DNS SANs, got %d", len(csr.DNSNames))
	}
	if csr.DNSNames[0] != "alias1.example.com" || csr.DNSNames[1] != "alias2.example.com" {
		t.Errorf("unexpected DNS SANs: %v", csr.DNSNames)
	}
}

func TestGenerateCSR_WithIPSANs(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	req := models.CSRRequest{
		Hostname:     "server.example.com",
		Organization: "Test Org",
		City:         "Paris",
		State:        "IDF",
		Country:      "FR",
		KeySize:      2048,
		SANs: []models.SANEntry{
			{Value: "192.168.1.1", Type: models.SANTypeIP},
			{Value: "10.0.0.1", Type: models.SANTypeIP},
		},
	}

	resp, err := svc.GenerateCSR(ctx, req, encryptionKey)
	if err != nil {
		t.Fatalf("GenerateCSR failed: %v", err)
	}

	block, _ := pem.Decode([]byte(resp.CSR))
	csr, err := x509.ParseCertificateRequest(block.Bytes)
	if err != nil {
		t.Fatalf("failed to parse CSR: %v", err)
	}

	if len(csr.IPAddresses) != 2 {
		t.Fatalf("expected 2 IP SANs, got %d", len(csr.IPAddresses))
	}
	expected1 := net.ParseIP("192.168.1.1")
	expected2 := net.ParseIP("10.0.0.1")
	if !csr.IPAddresses[0].Equal(expected1) {
		t.Errorf("expected IP SAN %v, got %v", expected1, csr.IPAddresses[0])
	}
	if !csr.IPAddresses[1].Equal(expected2) {
		t.Errorf("expected IP SAN %v, got %v", expected2, csr.IPAddresses[1])
	}
}

func TestGenerateCSR_StoresEncryptedKey(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	req := models.CSRRequest{
		Hostname:     "server.example.com",
		Organization: "Test Org",
		City:         "Paris",
		State:        "IDF",
		Country:      "FR",
		KeySize:      2048,
	}

	_, err := svc.GenerateCSR(ctx, req, encryptionKey)
	if err != nil {
		t.Fatalf("GenerateCSR failed: %v", err)
	}

	cert, err := database.Queries().GetCertificateByHostname(ctx, "server.example.com")
	if err != nil {
		t.Fatalf("failed to get certificate: %v", err)
	}

	// Verify the stored key can be decrypted
	decrypted, err := crypto.DecryptPrivateKey(cert.PendingEncryptedPrivateKey, encryptionKey)
	if err != nil {
		t.Fatalf("failed to decrypt stored key: %v", err)
	}
	if !strings.Contains(string(decrypted), "PRIVATE KEY") {
		t.Error("decrypted key should be PEM-encoded")
	}
}

func TestGenerateCSR_EmptyHostname_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	req := models.CSRRequest{
		Hostname:             "",
		Organization:         "Test Org",
		City:                 "Paris",
		State:                "IDF",
		Country:              "FR",
		KeySize:              2048,
		SkipSuffixValidation: true,
	}

	_, err := svc.GenerateCSR(ctx, req, encryptionKey)
	if err == nil {
		t.Fatal("expected error for empty hostname, got nil")
	}
	if !containsSubstring(err.Error(), "hostname cannot be empty") {
		t.Errorf("expected hostname empty error, got: %v", err)
	}
}

func TestGenerateCSR_HostnameSuffixValidation_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database) // config has suffix ".example.com"
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	req := models.CSRRequest{
		Hostname:     "server.wrongdomain.com",
		Organization: "Test Org",
		City:         "Paris",
		State:        "IDF",
		Country:      "FR",
		KeySize:      2048,
	}

	_, err := svc.GenerateCSR(ctx, req, encryptionKey)
	if err == nil {
		t.Fatal("expected error for wrong hostname suffix, got nil")
	}
	if !containsSubstring(err.Error(), "hostname must end with") {
		t.Errorf("expected suffix validation error, got: %v", err)
	}
}

func TestGenerateCSR_SkipSuffixValidation(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database) // config has suffix ".example.com"
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	req := models.CSRRequest{
		Hostname:             "server.otherdomain.com",
		Organization:         "Test Org",
		City:                 "Paris",
		State:                "IDF",
		Country:              "FR",
		KeySize:              2048,
		SkipSuffixValidation: true,
	}

	resp, err := svc.GenerateCSR(ctx, req, encryptionKey)
	if err != nil {
		t.Fatalf("expected success with skip suffix, got: %v", err)
	}
	if resp.Hostname != "server.otherdomain.com" {
		t.Errorf("expected hostname server.otherdomain.com, got %s", resp.Hostname)
	}
}

func TestGenerateCSR_DuplicateHostname_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	// Create an existing certificate
	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname: "server.example.com",
		ReadOnly: 0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	req := models.CSRRequest{
		Hostname:     "server.example.com",
		Organization: "Test Org",
		City:         "Paris",
		State:        "IDF",
		Country:      "FR",
		KeySize:      2048,
		IsRenewal:    false,
	}

	_, err = svc.GenerateCSR(ctx, req, encryptionKey)
	if err == nil {
		t.Fatal("expected error for duplicate hostname, got nil")
	}
	if !containsSubstring(err.Error(), "already exists") {
		t.Errorf("expected duplicate error, got: %v", err)
	}
}

func TestGenerateCSR_Renewal_UpdatesPendingColumns(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	// Create an existing certificate with an active cert
	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname:       "server.example.com",
		CertificatePem: sql.NullString{String: "existing-cert-pem", Valid: true},
		ReadOnly:       0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	req := models.CSRRequest{
		Hostname:     "server.example.com",
		Organization: "Test Org",
		City:         "Paris",
		State:        "IDF",
		Country:      "FR",
		KeySize:      2048,
		IsRenewal:    true,
	}

	resp, err := svc.GenerateCSR(ctx, req, encryptionKey)
	if err != nil {
		t.Fatalf("GenerateCSR renewal failed: %v", err)
	}
	if resp.Hostname != "server.example.com" {
		t.Errorf("expected hostname server.example.com, got %s", resp.Hostname)
	}

	// Verify pending columns are set and active cert preserved
	cert, err := database.Queries().GetCertificateByHostname(ctx, "server.example.com")
	if err != nil {
		t.Fatalf("failed to get certificate: %v", err)
	}
	if !cert.PendingCsrPem.Valid {
		t.Error("expected pending CSR to be set after renewal")
	}
	if len(cert.PendingEncryptedPrivateKey) == 0 {
		t.Error("expected pending encrypted key to be set after renewal")
	}
	if !cert.CertificatePem.Valid || cert.CertificatePem.String != "existing-cert-pem" {
		t.Error("expected active certificate to be preserved after renewal")
	}
}

func TestGenerateCSR_InvalidIPSAN_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	req := models.CSRRequest{
		Hostname:     "server.example.com",
		Organization: "Test Org",
		City:         "Paris",
		State:        "IDF",
		Country:      "FR",
		KeySize:      2048,
		SANs: []models.SANEntry{
			{Value: "not-an-ip", Type: models.SANTypeIP},
		},
	}

	_, err := svc.GenerateCSR(ctx, req, encryptionKey)
	if err == nil {
		t.Fatal("expected error for invalid IP SAN, got nil")
	}
	if !containsSubstring(err.Error(), "invalid IP") {
		t.Errorf("expected invalid IP error, got: %v", err)
	}
}

func TestGenerateCSR_InvalidSANType_ReturnsError(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	req := models.CSRRequest{
		Hostname:     "server.example.com",
		Organization: "Test Org",
		City:         "Paris",
		State:        "IDF",
		Country:      "FR",
		KeySize:      2048,
		SANs: []models.SANEntry{
			{Value: "something", Type: "unknown"},
		},
	}

	_, err := svc.GenerateCSR(ctx, req, encryptionKey)
	if err == nil {
		t.Fatal("expected error for unknown SAN type, got nil")
	}
	if !containsSubstring(err.Error(), "unknown SAN type") {
		t.Errorf("expected unknown SAN type error, got: %v", err)
	}
}

func TestGenerateCSR_LogsHistoryEvent(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	req := models.CSRRequest{
		Hostname:     "server.example.com",
		Organization: "Test Org",
		City:         "Paris",
		State:        "IDF",
		Country:      "FR",
		KeySize:      2048,
	}

	_, err := svc.GenerateCSR(ctx, req, encryptionKey)
	if err != nil {
		t.Fatalf("GenerateCSR failed: %v", err)
	}

	// Check history
	history := NewHistoryService(database)
	entries, err := history.GetHistory(ctx, "server.example.com", 10)
	if err != nil {
		t.Fatalf("GetHistory failed: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 history entry, got %d", len(entries))
	}
	if entries[0].EventType != models.EventCSRGenerated {
		t.Errorf("expected event type %s, got %s", models.EventCSRGenerated, entries[0].EventType)
	}
}

func TestGenerateCSR_Renewal_LogsHistoryEvent(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	// Create existing cert
	err := database.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
		Hostname: "server.example.com",
		ReadOnly: 0,
	})
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	req := models.CSRRequest{
		Hostname:     "server.example.com",
		Organization: "Test Org",
		City:         "Paris",
		State:        "IDF",
		Country:      "FR",
		KeySize:      2048,
		IsRenewal:    true,
	}

	_, err = svc.GenerateCSR(ctx, req, encryptionKey)
	if err != nil {
		t.Fatalf("GenerateCSR renewal failed: %v", err)
	}

	history := NewHistoryService(database)
	entries, err := history.GetHistory(ctx, "server.example.com", 10)
	if err != nil {
		t.Fatalf("GetHistory failed: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 history entry, got %d", len(entries))
	}
	if entries[0].EventType != models.EventCSRRegenerated {
		t.Errorf("expected event type %s, got %s", models.EventCSRRegenerated, entries[0].EventType)
	}
}

func TestGenerateCSR_WithNote(t *testing.T) {
	svc, database := setupTestService(t)
	setupTestConfig(t, database)
	ctx := context.Background()
	encryptionKey := testutil.RandomMasterKey(t)

	req := models.CSRRequest{
		Hostname:     "server.example.com",
		Organization: "Test Org",
		City:         "Paris",
		State:        "IDF",
		Country:      "FR",
		KeySize:      2048,
		Note:         "Production web server",
	}

	_, err := svc.GenerateCSR(ctx, req, encryptionKey)
	if err != nil {
		t.Fatalf("GenerateCSR failed: %v", err)
	}

	cert, err := database.Queries().GetCertificateByHostname(ctx, "server.example.com")
	if err != nil {
		t.Fatalf("failed to get certificate: %v", err)
	}
	if !cert.Note.Valid || cert.Note.String != "Production web server" {
		t.Errorf("expected note 'Production web server', got %v", cert.Note)
	}
}
