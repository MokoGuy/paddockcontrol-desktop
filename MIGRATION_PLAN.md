# PaddockControl Desktop - Feature Migration Plan

**From**: Web Application (certs4dedalus)  
**To**: Desktop Application (paddockcontrol-desktop)  
**Date**: January 2026  
**Status**: Planning Phase

---

## Executive Summary

This document outlines the migration strategy for transforming the web-based PaddockControl certificate management application into a cross-platform desktop application using Wails v2. The approach is:

- **Backend (Go)**: Port existing code with minimal changes - the logic is solid and well-structured
- **Frontend**: Complete rework from Templ templates to React + TypeScript + shadcn/ui

**Key Architecture Changes**:
- **HTTP Handlers → Wails Bindings**: Remove HTTP layer, expose methods directly to frontend
- **Server-Side Templates → React SPA**: Build modern component-based UI
- **Environment Config → Desktop Storage**: Use OS-specific data directories
- **Encryption Key**: Prompt user at startup instead of environment variable
- **Status Computation**: Calculate certificate status dynamically instead of storing

---

## Strategy Overview

### Backend Philosophy: PORT (95% as-is)
The existing Go backend is well-architected with:
- Clean separation of concerns (crypto, db, handlers)
- Type-safe database queries (SQLC)
- Robust cryptography operations
- Comprehensive validation logic

**Changes needed**:
- Remove HTTP request/response handling
- Expose methods via Wails bindings
- Adapt file I/O for desktop (native dialogs)
- Use OS-specific data directories
- Prompt for encryption key at startup
- Compute certificate status dynamically

### Frontend Philosophy: REWORK (100% new)
The Templ templates need complete rewrite:
- Server-side rendering → Client-side React
- Go templates → TypeScript components
- Custom CSS → Tailwind v4 + shadcn/ui
- No JavaScript → Modern React with hooks

---

## Migration Phases

### Phase 0: Foundation ✓
**Status**: Complete

- ✓ Wails v2.11.0 project initialized
- ✓ React 18.3 + TypeScript 5.7
- ✓ Vite 5.4 with HMR
- ✓ Tailwind CSS v4
- ✓ shadcn/ui components
- ✓ Build system (Task)

---

### Phase 1: Backend Core - Direct Port
**Priority**: Critical First  
**Strategy**: Copy and adapt

#### 1.1 Database Layer (Copy as-is)
**Source**: `certs4dedalus/internal/db/`  
**Target**: `paddockcontrol-desktop/internal/db/`

**Files to copy directly**:
```
internal/db/
├── migrations/
│   ├── 000001_initial.up.sql
│   ├── 000001_initial.down.sql
│   ├── 000002_remove_ca_urls.up.sql
│   ├── 000002_remove_ca_urls.down.sql
│   ├── 000003_readonly_flag.up.sql
│   └── 000003_readonly_flag.down.sql
├── queries.sql              # SQLC queries - adapt as needed
└── sqlc.yaml               # SQLC config - copy as-is
```

**Schema Changes Required**:

1. **Remove `status` column from certificates table** (compute dynamically)
2. **Add `is_configured` to config table** (track setup completion)

**Migration 000004: Desktop adaptations**:
```sql
-- 000004_desktop_adaptations.up.sql

-- Remove status column (will be computed)
ALTER TABLE certificates DROP COLUMN status;

-- Add is_configured flag to config
ALTER TABLE config ADD COLUMN is_configured INTEGER DEFAULT 0;
```

**New files needed**:
```go
// internal/db/database.go
package db

import (
    "database/sql"
    "embed"
    "path/filepath"
    
    "github.com/golang-migrate/migrate/v4"
    "github.com/golang-migrate/migrate/v4/database/sqlite3"
    "github.com/golang-migrate/migrate/v4/source/iofs"
    _ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrations embed.FS

type Database struct {
    db      *sql.DB
    queries *Queries
}

func NewDatabase(dataDir string) (*Database, error) {
    dbPath := filepath.Join(dataDir, "certificates.db")
    
    // Open with WAL mode
    db, err := sql.Open("sqlite", dbPath+"?_journal_mode=WAL")
    if err != nil {
        return nil, err
    }
    
    // Run migrations
    if err := runMigrations(db); err != nil {
        return nil, err
    }
    
    return &Database{
        db:      db,
        queries: New(db),
    }, nil
}

func runMigrations(db *sql.DB) error {
    driver, err := sqlite3.WithInstance(db, &sqlite3.Config{})
    if err != nil {
        return err
    }
    
    sourceDriver, err := iofs.New(migrations, "migrations")
    if err != nil {
        return err
    }
    
    m, err := migrate.NewWithInstance("iofs", sourceDriver, "sqlite3", driver)
    if err != nil {
        return err
    }
    
    return m.Up()
}

func (d *Database) Close() error {
    return d.db.Close()
}

func (d *Database) Queries() *Queries {
    return d.queries
}
```

**SQLC Queries Adaptations**:
```sql
-- queries.sql (adapted from webapp)

-- Update: Remove status from INSERT/UPDATE
-- name: CreateCertificate :exec
INSERT INTO certificates (
    hostname,
    encrypted_private_key,
    pending_csr_pem,
    certificate_pem,
    pending_encrypted_private_key,
    created_at,
    expires_at,
    last_modified,
    note,
    pending_note,
    read_only
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- Add: IsConfigured check
-- name: IsConfigured :one
SELECT is_configured FROM config WHERE id = 1;

-- name: SetConfigured :exec
UPDATE config SET is_configured = 1 WHERE id = 1;
```

**Status Computation Logic**:
```go
// internal/db/status.go
package db

import "time"

type CertificateStatus string

const (
    StatusPending  CertificateStatus = "pending"
    StatusActive   CertificateStatus = "active"
    StatusExpiring CertificateStatus = "expiring"
    StatusExpired  CertificateStatus = "expired"
)

// ComputeStatus determines certificate status based on data
func ComputeStatus(cert *Certificate) CertificateStatus {
    // Has certificate PEM? Active/Expiring/Expired
    if cert.CertificatePEM != "" {
        if cert.ExpiresAt == 0 {
            return StatusActive
        }
        
        expiresTime := time.Unix(cert.ExpiresAt, 0)
        now := time.Now()
        
        if now.After(expiresTime) {
            return StatusExpired
        }
        
        daysUntilExpiration := int(time.Until(expiresTime).Hours() / 24)
        if daysUntilExpiration <= 30 {
            return StatusExpiring
        }
        
        return StatusActive
    }
    
    // Has pending CSR? Pending
    if cert.PendingCSR != "" {
        return StatusPending
    }
    
    // Shouldn't happen, but default to pending
    return StatusPending
}
```

**Tasks**:
- [ ] Copy migration files (000001-000003)
- [ ] Create 000004_desktop_adaptations migration
- [ ] Copy and adapt queries.sql (remove status, add is_configured)
- [ ] Copy sqlc.yaml
- [ ] Run `sqlc generate`
- [ ] Create database.go with init logic
- [ ] Create status.go with computation logic
- [ ] Add OS-specific data directory resolution
- [ ] Copy test files from webapp
- [ ] Test database initialization

#### 1.2 Crypto Layer (Copy verbatim)
**Source**: `certs4dedalus/internal/crypto/`  
**Target**: `paddockcontrol-desktop/internal/crypto/`

**Copy entire directory - NO changes needed**:
```
internal/crypto/
├── encryption.go      # AES-256-GCM - copy as-is
├── keygen.go         # RSA generation - copy as-is
├── csr.go            # CSR operations - copy as-is
├── cert.go           # Certificate parsing - copy as-is
├── chain.go          # Chain building - copy as-is
└── validation.go     # All validations - copy as-is
```

These are pure crypto operations with no HTTP dependencies. They work perfectly as-is.

**Encryption Key Management**:
The crypto layer expects an encryption key. In the desktop app:
- User provides key at startup (via dialog)
- App keeps key in memory for session duration
- Key is NOT stored on disk
- If user forgets key, encrypted private keys are unrecoverable

**Tasks**:
- [ ] Copy entire crypto/ directory
- [ ] Copy crypto test files from webapp
- [ ] Verify imports compile
- [ ] Run tests
- [ ] No modifications needed

#### 1.3 Config Layer (Minor adaptations)
**Source**: `certs4dedalus/internal/config/`  
**Target**: `paddockcontrol-desktop/internal/config/`

**Copy and adapt**:
```go
// internal/config/config.go
package config

import (
    "context"
    "paddockcontrol-desktop/internal/db"
)

type Service struct {
    db *db.Database
}

func NewService(database *db.Database) *Service {
    return &Service{db: database}
}

// GetConfig loads config from database
func (s *Service) GetConfig(ctx context.Context) (*db.Config, error) {
    return s.db.Queries().GetConfig(ctx)
}

// SaveConfig updates config in database
func (s *Service) SaveConfig(ctx context.Context, cfg *db.Config) error {
    return s.db.Queries().UpdateConfig(ctx, cfg)
}

// IsConfigured checks if initial setup is complete (from DB)
func (s *Service) IsConfigured(ctx context.Context) (bool, error) {
    configured, err := s.db.Queries().IsConfigured(ctx)
    if err != nil {
        return false, err
    }
    return configured == 1, nil
}

// SetConfigured marks setup as complete in DB
func (s *Service) SetConfigured(ctx context.Context) error {
    return s.db.Queries().SetConfigured(ctx)
}

// GetDefaults returns default values for new configuration
func (s *Service) GetDefaults() *ConfigDefaults {
    return &ConfigDefaults{
        ValidityPeriodDays: 365,
        DefaultKeySize:     4096,
        DefaultCountry:     "US",
    }
}

type ConfigDefaults struct {
    ValidityPeriodDays int
    DefaultKeySize     int
    DefaultCountry     string
}
```

**Changes from webapp**:
- Remove environment variable parsing
- Keep database-backed config as-is
- Add IsConfigured() from database (not computed)
- Add SetConfigured() to mark setup complete

**Tasks**:
- [ ] Copy config structures
- [ ] Adapt to read from database only
- [ ] Remove env var dependencies
- [ ] Add IsConfigured/SetConfigured helpers
- [ ] Copy config test files
- [ ] Test configuration service

#### 1.4 Models (Copy with JSON tags)
**Source**: `certs4dedalus/internal/models/`  
**Target**: `paddockcontrol-desktop/internal/models/`

**Copy and add JSON tags for Wails**:
```go
// internal/models/certificate.go
package models

type Certificate struct {
    Hostname           string   `json:"hostname"`
    EncryptedKey       []byte   `json:"-"` // Never send to frontend
    PendingCSR         string   `json:"pending_csr,omitempty"`
    CertificatePEM     string   `json:"certificate_pem,omitempty"`
    CreatedAt          int64    `json:"created_at"`
    ExpiresAt          int64    `json:"expires_at"`
    Note               string   `json:"note,omitempty"`
    PendingNote        string   `json:"pending_note,omitempty"`
    ReadOnly           bool     `json:"read_only"`
    
    // Computed fields (not in DB)
    Status             string   `json:"status"` // pending, active, expiring, expired
    SANs               []string `json:"sans,omitempty"`
    Organization       string   `json:"organization,omitempty"`
    City               string   `json:"city,omitempty"`
    State              string   `json:"state,omitempty"`
    Country            string   `json:"country,omitempty"`
    KeySize            int      `json:"key_size,omitempty"`
    DaysUntilExpiration int     `json:"days_until_expiration,omitempty"`
}

type CertificateListItem struct {
    Hostname            string   `json:"hostname"`
    Status              string   `json:"status"` // computed
    SANs                []string `json:"sans,omitempty"`
    KeySize             int      `json:"key_size,omitempty"`
    CreatedAt           int64    `json:"created_at"`
    ExpiresAt           int64    `json:"expires_at"`
    DaysUntilExpiration int      `json:"days_until_expiration,omitempty"`
    ReadOnly            bool     `json:"read_only"`
}

type CSRRequest struct {
    Hostname             string   `json:"hostname"`
    SANs                 []string `json:"sans"`
    Organization         string   `json:"organization"`
    OrganizationalUnit   string   `json:"organizational_unit,omitempty"`
    City                 string   `json:"city"`
    State                string   `json:"state"`
    Country              string   `json:"country"`
    KeySize              int      `json:"key_size"`
    Note                 string   `json:"note,omitempty"`
    IsRenewal            bool     `json:"is_renewal,omitempty"`
}

type CSRResponse struct {
    Hostname  string `json:"hostname"`
    CSR       string `json:"csr"`
    Message   string `json:"message"`
}

type ImportRequest struct {
    CertificatePEM string `json:"certificate_pem"`
    PrivateKeyPEM  string `json:"private_key_pem"`
    CertChainPEM   string `json:"cert_chain_pem,omitempty"`
    Note           string `json:"note,omitempty"`
}

type CertificateFilter struct {
    Status    string `json:"status,omitempty"` // all, pending, active, expiring, expired
    SortBy    string `json:"sort_by,omitempty"` // created, expiring, hostname
    SortOrder string `json:"sort_order,omitempty"` // asc, desc
}
```

**Tasks**:
- [ ] Copy all model structs
- [ ] Add JSON tags for Wails serialization
- [ ] Never expose sensitive data (encrypted keys)
- [ ] Add omitempty for optional fields
- [ ] Mark computed fields clearly
- [ ] Copy model test files

---

### Phase 2: Backend Services - Refactor Handlers to Services
**Priority**: Critical  
**Strategy**: Extract business logic from HTTP handlers

#### 2.1 Certificate Service
**Source**: `certs4dedalus/internal/handlers/{csr.go, upload.go, import.go}`  
**Target**: `paddockcontrol-desktop/internal/services/certificate_service.go`

**Extract pure business logic**:
```go
// internal/services/certificate_service.go
package services

import (
    "context"
    "fmt"
    "time"
    "paddockcontrol-desktop/internal/db"
    "paddockcontrol-desktop/internal/crypto"
    "paddockcontrol-desktop/internal/config"
    "paddockcontrol-desktop/internal/models"
)

type CertificateService struct {
    db     *db.Database
    crypto *crypto.Service
    config *config.Service
}

func NewCertificateService(database *db.Database, cryptoSvc *crypto.Service, configSvc *config.Service) *CertificateService {
    return &CertificateService{
        db:     database,
        crypto: cryptoSvc,
        config: configSvc,
    }
}

// GenerateCSR - extract from csr.go handler
func (s *CertificateService) GenerateCSR(ctx context.Context, req models.CSRRequest) (*models.CSRResponse, error) {
    // Validate hostname
    if err := s.validateHostname(ctx, req.Hostname); err != nil {
        return nil, err
    }
    
    // Check for duplicates
    exists, err := s.db.Queries().CertificateExists(ctx, req.Hostname)
    if err != nil {
        return nil, err
    }
    if exists && !req.IsRenewal {
        return nil, fmt.Errorf("certificate already exists for hostname: %s", req.Hostname)
    }
    
    // Generate RSA key pair
    privateKey, err := s.crypto.GenerateRSAKey(req.KeySize)
    if err != nil {
        return nil, err
    }
    
    // Create CSR
    csrPEM, err := s.crypto.GenerateCSR(privateKey, req)
    if err != nil {
        return nil, err
    }
    
    // Encrypt private key
    encryptedKey, err := s.crypto.EncryptPrivateKey(privateKey)
    if err != nil {
        return nil, err
    }
    
    // Store in database
    if req.IsRenewal {
        err = s.db.Queries().StorePendingRenewal(ctx, db.StorePendingRenewalParams{
            Hostname:              req.Hostname,
            PendingCSR:           csrPEM,
            PendingEncryptedKey:  encryptedKey,
            PendingNote:          req.Note,
        })
    } else {
        err = s.db.Queries().CreateCertificate(ctx, db.CreateCertificateParams{
            Hostname:         req.Hostname,
            EncryptedKey:     encryptedKey,
            PendingCSR:       csrPEM,
            Note:             req.Note,
        })
    }
    
    if err != nil {
        return nil, err
    }
    
    return &models.CSRResponse{
        Hostname: req.Hostname,
        CSR:      csrPEM,
        Message:  "CSR generated successfully",
    }, nil
}

// UploadCertificate - extract from upload.go handler
func (s *CertificateService) UploadCertificate(ctx context.Context, hostname, certPEM string) error {
    // Get pending certificate
    cert, err := s.db.Queries().GetCertificate(ctx, hostname)
    if err != nil {
        return err
    }
    
    // Verify has pending CSR
    if cert.PendingCSR == "" {
        return fmt.Errorf("no pending CSR for hostname: %s", hostname)
    }
    
    // Validate certificate matches CSR
    if err := s.crypto.ValidateCertificateMatchesCSR(certPEM, cert.PendingCSR); err != nil {
        return err
    }
    
    // Parse certificate for metadata
    certInfo, err := s.crypto.ParseCertificate(certPEM)
    if err != nil {
        return err
    }
    
    // Update in database
    return s.db.Queries().ActivateCertificate(ctx, db.ActivateCertificateParams{
        Hostname:       hostname,
        CertificatePEM: certPEM,
        ExpiresAt:      certInfo.ExpiresAt.Unix(),
    })
}

// ImportCertificate - extract from import.go handler
func (s *CertificateService) ImportCertificate(ctx context.Context, req models.ImportRequest) error {
    // Validate cert and key match
    if err := s.crypto.ValidateCertificateAndKey(req.CertificatePEM, req.PrivateKeyPEM); err != nil {
        return err
    }
    
    // Parse certificate
    certInfo, err := s.crypto.ParseCertificate(req.CertificatePEM)
    if err != nil {
        return err
    }
    
    // Encrypt private key
    privateKey, err := s.crypto.ParsePrivateKey(req.PrivateKeyPEM)
    if err != nil {
        return err
    }
    
    encryptedKey, err := s.crypto.EncryptPrivateKey(privateKey)
    if err != nil {
        return err
    }
    
    // Check for duplicates
    exists, err := s.db.Queries().CertificateExists(ctx, certInfo.Hostname)
    if err != nil {
        return err
    }
    if exists {
        return fmt.Errorf("certificate already exists for hostname: %s", certInfo.Hostname)
    }
    
    // Store in database
    return s.db.Queries().CreateCertificate(ctx, db.CreateCertificateParams{
        Hostname:       certInfo.Hostname,
        EncryptedKey:   encryptedKey,
        CertificatePEM: req.CertificatePEM,
        ExpiresAt:      certInfo.ExpiresAt.Unix(),
        Note:           req.Note,
    })
}

// ListCertificates - extract from dashboard.go handler
func (s *CertificateService) ListCertificates(ctx context.Context, filter models.CertificateFilter) ([]*models.CertificateListItem, error) {
    // Get all certificates from DB
    certs, err := s.db.Queries().ListAllCertificates(ctx)
    if err != nil {
        return nil, err
    }
    
    // Convert to list items with computed fields
    items := make([]*models.CertificateListItem, 0, len(certs))
    for _, cert := range certs {
        // Compute status
        status := db.ComputeStatus(cert)
        
        // Filter by status if specified
        if filter.Status != "" && filter.Status != "all" {
            if string(status) != filter.Status {
                continue
            }
        }
        
        item := s.toCertificateListItem(cert, status)
        items = append(items, item)
    }
    
    // Apply sorting
    s.sortCertificates(items, filter.SortBy, filter.SortOrder)
    
    return items, nil
}

// GetCertificate - extract from details.go handler
func (s *CertificateService) GetCertificate(ctx context.Context, hostname string) (*models.Certificate, error) {
    dbCert, err := s.db.Queries().GetCertificate(ctx, hostname)
    if err != nil {
        return nil, err
    }
    
    // Compute status
    status := db.ComputeStatus(dbCert)
    
    cert := &models.Certificate{
        Hostname:      dbCert.Hostname,
        PendingCSR:    dbCert.PendingCSR,
        CertificatePEM: dbCert.CertificatePEM,
        CreatedAt:     dbCert.CreatedAt,
        ExpiresAt:     dbCert.ExpiresAt,
        Status:        string(status),
        Note:          dbCert.Note,
        PendingNote:   dbCert.PendingNote,
        ReadOnly:      dbCert.ReadOnly,
    }
    
    // Parse and add computed fields
    if cert.CertificatePEM != "" {
        certInfo, _ := s.crypto.ParseCertificate(cert.CertificatePEM)
        if certInfo != nil {
            cert.SANs = certInfo.SANs
            cert.Organization = certInfo.Organization
            cert.City = certInfo.City
            cert.State = certInfo.State
            cert.Country = certInfo.Country
            cert.KeySize = certInfo.KeySize
            cert.DaysUntilExpiration = s.calculateDaysUntilExpiration(cert.ExpiresAt)
        }
    } else if cert.PendingCSR != "" {
        // Parse CSR for metadata if no cert yet
        csrInfo, _ := s.crypto.ParseCSR(cert.PendingCSR)
        if csrInfo != nil {
            cert.SANs = csrInfo.SANs
            cert.Organization = csrInfo.Organization
            cert.City = csrInfo.City
            cert.State = csrInfo.State
            cert.Country = csrInfo.Country
            cert.KeySize = csrInfo.KeySize
        }
    }
    
    return cert, nil
}

// DeleteCertificate
func (s *CertificateService) DeleteCertificate(ctx context.Context, hostname string) error {
    // Check read-only
    cert, err := s.db.Queries().GetCertificate(ctx, hostname)
    if err != nil {
        return err
    }
    
    if cert.ReadOnly {
        return fmt.Errorf("certificate is read-only and cannot be deleted")
    }
    
    return s.db.Queries().DeleteCertificate(ctx, hostname)
}

// GetCSRForDownload - returns CSR PEM for download
func (s *CertificateService) GetCSRForDownload(ctx context.Context, hostname string) (string, error) {
    cert, err := s.db.Queries().GetCertificate(ctx, hostname)
    if err != nil {
        return "", err
    }
    return cert.PendingCSR, nil
}

// GetCertificateForDownload - returns certificate PEM for download
func (s *CertificateService) GetCertificateForDownload(ctx context.Context, hostname string) (string, error) {
    cert, err := s.db.Queries().GetCertificate(ctx, hostname)
    if err != nil {
        return "", err
    }
    return cert.CertificatePEM, nil
}

// GetPrivateKeyForDownload - returns decrypted private key PEM
func (s *CertificateService) GetPrivateKeyForDownload(ctx context.Context, hostname string) (string, error) {
    cert, err := s.db.Queries().GetCertificate(ctx, hostname)
    if err != nil {
        return "", err
    }
    
    privateKey, err := s.crypto.DecryptPrivateKey(cert.EncryptedKey)
    if err != nil {
        return "", err
    }
    
    return s.crypto.EncodePrivateKeyToPEM(privateKey), nil
}

// Helper methods
func (s *CertificateService) validateHostname(ctx context.Context, hostname string) error {
    cfg, err := s.config.GetConfig(ctx)
    if err != nil {
        return err
    }
    
    if cfg.HostnameSuffix != "" {
        if !strings.HasSuffix(hostname, cfg.HostnameSuffix) {
            return fmt.Errorf("hostname must end with %s", cfg.HostnameSuffix)
        }
    }
    
    return nil
}

func (s *CertificateService) calculateDaysUntilExpiration(expiresAt int64) int {
    if expiresAt == 0 {
        return 0
    }
    expiresTime := time.Unix(expiresAt, 0)
    duration := time.Until(expiresTime)
    return int(duration.Hours() / 24)
}

func (s *CertificateService) toCertificateListItem(cert *db.Certificate, status db.CertificateStatus) *models.CertificateListItem {
    item := &models.CertificateListItem{
        Hostname:  cert.Hostname,
        Status:    string(status),
        CreatedAt: cert.CreatedAt,
        ExpiresAt: cert.ExpiresAt,
        ReadOnly:  cert.ReadOnly,
    }
    
    // Parse cert/CSR for additional fields
    if cert.CertificatePEM != "" {
        if certInfo, err := s.crypto.ParseCertificate(cert.CertificatePEM); err == nil {
            item.SANs = certInfo.SANs
            item.KeySize = certInfo.KeySize
            item.DaysUntilExpiration = s.calculateDaysUntilExpiration(cert.ExpiresAt)
        }
    } else if cert.PendingCSR != "" {
        if csrInfo, err := s.crypto.ParseCSR(cert.PendingCSR); err == nil {
            item.SANs = csrInfo.SANs
            item.KeySize = csrInfo.KeySize
        }
    }
    
    return item
}

func (s *CertificateService) sortCertificates(certs []*models.CertificateListItem, sortBy, sortOrder string) {
    // Implement sorting logic from webapp
    // Sort by: created, expiring, hostname
}
```

**Tasks**:
- [ ] Extract GenerateCSR logic from handler
- [ ] Extract UploadCertificate logic
- [ ] Extract ImportCertificate logic
- [ ] Extract ListCertificates with filtering (compute status per cert)
- [ ] Extract GetCertificate with details
- [ ] Extract DeleteCertificate with validation
- [ ] Extract download methods (CSR, cert, key)
- [ ] Add helper methods for validation and conversion
- [ ] Copy and adapt test files from webapp handlers
- [ ] Test all certificate operations

#### 2.2 Backup Service
**Source**: `certs4dedalus/internal/handlers/backup.go`  
**Target**: `paddockcontrol-desktop/internal/services/backup_service.go`

**Extract backup/restore logic**:
```go
// internal/services/backup_service.go
package services

import (
    "context"
    "time"
    "paddockcontrol-desktop/internal/db"
    "paddockcontrol-desktop/internal/crypto"
    "paddockcontrol-desktop/internal/models"
)

type BackupService struct {
    db     *db.Database
    crypto *crypto.Service
}

func NewBackupService(database *db.Database, cryptoSvc *crypto.Service) *BackupService {
    return &BackupService{
        db:     database,
        crypto: cryptoSvc,
    }
}

// ExportBackup - extract from backup.go handler
func (s *BackupService) ExportBackup(ctx context.Context, includeKeys bool) (*models.BackupData, error) {
    // Get all certificates
    certs, err := s.db.Queries().ListAllCertificates(ctx)
    if err != nil {
        return nil, err
    }
    
    // Get config
    cfg, err := s.db.Queries().GetConfig(ctx)
    if err != nil {
        return nil, err
    }
    
    backup := &models.BackupData{
        Version:       "1.0",
        ExportedAt:    time.Now().Unix(),
        Config:        cfg,
        Certificates:  make([]*models.BackupCertificate, len(certs)),
    }
    
    for i, cert := range certs {
        backupCert := &models.BackupCertificate{
            Hostname:       cert.Hostname,
            PendingCSR:     cert.PendingCSR,
            CertificatePEM: cert.CertificatePEM,
            CreatedAt:      cert.CreatedAt,
            ExpiresAt:      cert.ExpiresAt,
            Note:           cert.Note,
            PendingNote:    cert.PendingNote,
            ReadOnly:       cert.ReadOnly,
        }
        
        if includeKeys {
            backupCert.EncryptedKey = cert.EncryptedKey
            backupCert.PendingEncryptedKey = cert.PendingEncryptedKey
        }
        
        backup.Certificates[i] = backupCert
    }
    
    return backup, nil
}

// ImportBackup - extract from backup.go handler
func (s *BackupService) ImportBackup(ctx context.Context, backup *models.BackupData) (*models.ImportResult, error) {
    result := &models.ImportResult{
        Success:   0,
        Skipped:   0,
        Failed:    0,
        Conflicts: []string{},
    }
    
    // Validate backup format
    if err := s.validateBackup(backup); err != nil {
        return nil, err
    }
    
    // Import certificates
    for _, cert := range backup.Certificates {
        exists, err := s.db.Queries().CertificateExists(ctx, cert.Hostname)
        if err != nil {
            result.Failed++
            continue
        }
        
        if exists {
            result.Skipped++
            result.Conflicts = append(result.Conflicts, cert.Hostname)
            continue
        }
        
        // Insert certificate
        err = s.db.Queries().CreateCertificate(ctx, db.CreateCertificateParams{
            Hostname:               cert.Hostname,
            EncryptedKey:           cert.EncryptedKey,
            PendingCSR:             cert.PendingCSR,
            CertificatePEM:         cert.CertificatePEM,
            PendingEncryptedKey:    cert.PendingEncryptedKey,
            ExpiresAt:              cert.ExpiresAt,
            Note:                   cert.Note,
            PendingNote:            cert.PendingNote,
            ReadOnly:               cert.ReadOnly,
        })
        
        if err != nil {
            result.Failed++
        } else {
            result.Success++
        }
    }
    
    // Optionally restore config (don't overwrite is_configured flag)
    if backup.Config != nil {
        _ = s.db.Queries().UpdateConfig(ctx, backup.Config)
    }
    
    return result, nil
}

func (s *BackupService) validateBackup(backup *models.BackupData) error {
    if backup.Version == "" {
        return fmt.Errorf("invalid backup: missing version")
    }
    // More validation...
    return nil
}
```

**Tasks**:
- [ ] Extract ExportBackup logic
- [ ] Extract ImportBackup logic
- [ ] Add validation for backup format
- [ ] Add conflict detection and reporting
- [ ] Copy and adapt test files
- [ ] Test backup/restore operations

#### 2.3 Setup Service
**Source**: `certs4dedalus/internal/handlers/setup.go`  
**Target**: `paddockcontrol-desktop/internal/services/setup_service.go`

**IMPORTANT**: Setup process needs review before implementation. Key considerations:
- First run: Offer "Restore from Backup" OR "Configure from Scratch"
- Encryption key: User supplies at startup
- If restoring: 
  - Encryption key can be present in backup (optional)
  - If not present in backup, ask user to provide it
  - Import backup, then mark as configured
- If configuring: Setup wizard, then mark as configured
- **Note**: CA Root Certificate URL no longer needed (removed in migration 000002)
  - Certificate chain building now uses AIA (Authority Information Access) extension from certificates

**Placeholder structure** (will be reviewed in Phase 2 implementation):
```go
// internal/services/setup_service.go
package services

import (
    "context"
    "paddockcontrol-desktop/internal/db"
    "paddockcontrol-desktop/internal/config"
    "paddockcontrol-desktop/internal/models"
)

type SetupService struct {
    db            *db.Database
    config        *config.Service
    backupService *BackupService
}

func NewSetupService(database *db.Database, configSvc *config.Service, backupSvc *BackupService) *SetupService {
    return &SetupService{
        db:            database,
        config:        configSvc,
        backupService: backupSvc,
    }
}

// IsConfigured checks if initial setup is complete (from DB)
func (s *SetupService) IsConfigured(ctx context.Context) (bool, error) {
    return s.config.IsConfigured(ctx)
}

// SetupFromScratch - new configuration wizard
func (s *SetupService) SetupFromScratch(ctx context.Context, req models.SetupRequest) error {
    // TODO: Review implementation in Phase 2
    // Validate setup request
    // Store config in database
    // Mark as configured
    return nil
}

// SetupFromBackup - restore from backup file
func (s *SetupService) SetupFromBackup(ctx context.Context, backup *models.BackupData) error {
    // TODO: Review implementation in Phase 2
    // Check if backup contains encrypted keys
    // If yes: Verify encryption key works (try to decrypt one key)
    // If no keys in backup: No validation needed
    // Import backup (certificates + config)
    // Mark as configured even if some imports failed
    result, err := s.backupService.ImportBackup(ctx, backup)
    if err != nil {
        return err
    }
    
    return s.config.SetConfigured(ctx)
}

// GetSetupDefaults returns default values for setup form
func (s *SetupService) GetSetupDefaults() *models.SetupDefaults {
    return &models.SetupDefaults{
        ValidityPeriodDays: 365,
        DefaultKeySize:     4096,
        DefaultCountry:     "US",
    }
}
```

**Notes**:
- CA Root Certificate URL field removed in migration 000002 (already done in webapp)
- Chain building uses AIA extension from certificates
- Backup can contain encrypted keys or not (user choice during export)
- If restoring backup with keys: Validate encryption key can decrypt them
- If restoring backup without keys: Skip key validation

**Tasks**:
- [ ] DEFER: Review setup flow in Phase 2 implementation
- [ ] Define clear first-run experience
- [ ] Implement restore-or-configure choice
- [ ] Handle optional encryption key in backup restore
- [ ] Copy relevant test files

---

### Phase 3: Wails App Integration
**Priority**: Critical  
**Strategy**: Wire up services to Wails bindings

#### 3.1 Encryption Key Management
**User supplies encryption key at app startup**

```go
// app.go - startup flow

func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    
    // Step 1: Get data directory
    dataDir, err := a.getDataDirectory()
    if err != nil {
        a.showError("Failed to get data directory", err)
        return
    }
    
    // Step 2: Initialize database (without encryption key yet)
    a.db, err = db.NewDatabase(dataDir)
    if err != nil {
        a.showError("Failed to initialize database", err)
        return
    }
    
    // Step 3: Check if configured
    configService := config.NewService(a.db)
    isConfigured, err := configService.IsConfigured(ctx)
    if err != nil {
        a.showError("Failed to check configuration", err)
        return
    }
    
    // Step 4: Prompt for encryption key
    // Frontend will call ProvideEncryptionKey() method
    a.waitingForEncryptionKey = true
    a.isConfigured = isConfigured
    
    // Services will be initialized after encryption key is provided
}

// ProvideEncryptionKey - called by frontend after user enters key
func (a *App) ProvideEncryptionKey(key string) error {
    if key == "" {
        return fmt.Errorf("encryption key cannot be empty")
    }
    
    // Validate key (e.g., minimum length)
    if len(key) < 16 {
        return fmt.Errorf("encryption key must be at least 16 characters")
    }
    
    // Store in memory for session
    a.encryptionKey = key
    a.waitingForEncryptionKey = false
    
    // Initialize crypto service with key
    cryptoService := crypto.NewService(a.encryptionKey)
    
    // Initialize all services
    a.configService = config.NewService(a.db)
    a.certificateService = services.NewCertificateService(a.db, cryptoService, a.configService)
    a.backupService = services.NewBackupService(a.db, cryptoService)
    a.setupService = services.NewSetupService(a.db, a.configService, a.backupService)
    
    return nil
}

// IsWaitingForEncryptionKey - frontend checks this
func (a *App) IsWaitingForEncryptionKey() bool {
    return a.waitingForEncryptionKey
}
```

**Startup Flow**:
1. App starts → Initialize database
2. Check IsConfigured from DB
3. Prompt user for encryption key (always required)
4. User provides key → Initialize services
5. If not configured: Show restore-or-configure choice
6. If configured: Navigate to dashboard

#### 3.2 App Structure

```go
// app.go
package main

import (
    "context"
    "fmt"
    "os"
    "path/filepath"
    "runtime"
    
    "github.com/wailsapp/wails/v2/pkg/runtime"
    "paddockcontrol-desktop/internal/db"
    "paddockcontrol-desktop/internal/config"
    "paddockcontrol-desktop/internal/crypto"
    "paddockcontrol-desktop/internal/services"
)

type App struct {
    ctx                   context.Context
    db                    *db.Database
    certificateService    *services.CertificateService
    backupService         *services.BackupService
    setupService          *services.SetupService
    configService         *config.Service
    
    // Encryption key (in memory only)
    encryptionKey         string
    waitingForEncryptionKey bool
    isConfigured          bool
}

func NewApp() *App {
    return &App{}
}

func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    
    // Get application data directory
    dataDir, err := a.getDataDirectory()
    if err != nil {
        a.showError("Initialization Error", fmt.Sprintf("Failed to get data directory: %v", err))
        return
    }
    
    // Initialize database
    a.db, err = db.NewDatabase(dataDir)
    if err != nil {
        a.showError("Database Error", fmt.Sprintf("Failed to initialize database: %v", err))
        return
    }
    
    // Check if configured
    tmpConfigService := config.NewService(a.db)
    a.isConfigured, err = tmpConfigService.IsConfigured(ctx)
    if err != nil {
        a.showError("Configuration Error", fmt.Sprintf("Failed to check configuration: %v", err))
        return
    }
    
    // Wait for encryption key from user
    a.waitingForEncryptionKey = true
}

func (a *App) shutdown(ctx context.Context) {
    if a.db != nil {
        a.db.Close()
    }
    
    // Clear encryption key from memory
    a.encryptionKey = ""
}

func (a *App) getDataDirectory() (string, error) {
    homeDir, err := os.UserHomeDir()
    if err != nil {
        return "", err
    }
    
    var dataDir string
    switch runtime.GOOS {
    case "windows":
        dataDir = filepath.Join(os.Getenv("APPDATA"), "PaddockControl")
    case "darwin":
        dataDir = filepath.Join(homeDir, "Library", "Application Support", "PaddockControl")
    default: // linux
        dataDir = filepath.Join(homeDir, ".local", "share", "paddockcontrol")
    }
    
    // Create directory if not exists
    if err := os.MkdirAll(dataDir, 0700); err != nil {
        return "", err
    }
    
    return dataDir, nil
}

func (a *App) showError(title, message string) {
    runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
        Type:    runtime.ErrorDialog,
        Title:   title,
        Message: message,
    })
}
```

#### 3.3 Method Bindings

```go
// Startup and encryption key management
func (a *App) IsWaitingForEncryptionKey() bool {
    return a.waitingForEncryptionKey
}

func (a *App) ProvideEncryptionKey(key string) error {
    if key == "" {
        return fmt.Errorf("encryption key cannot be empty")
    }
    
    if len(key) < 16 {
        return fmt.Errorf("encryption key must be at least 16 characters")
    }
    
    // Store in memory
    a.encryptionKey = key
    a.waitingForEncryptionKey = false
    
    // Initialize services
    cryptoService := crypto.NewService(a.encryptionKey)
    a.configService = config.NewService(a.db)
    a.certificateService = services.NewCertificateService(a.db, cryptoService, a.configService)
    a.backupService = services.NewBackupService(a.db, cryptoService)
    a.setupService = services.NewSetupService(a.db, a.configService, a.backupService)
    
    return nil
}

// Setup operations
func (a *App) IsSetupComplete() (bool, error) {
    if a.setupService == nil {
        return a.isConfigured, nil
    }
    return a.setupService.IsConfigured(a.ctx)
}

func (a *App) GetConfig() (*db.Config, error) {
    return a.configService.GetConfig(a.ctx)
}

func (a *App) SaveSetup(req models.SetupRequest) error {
    return a.setupService.SetupFromScratch(a.ctx, req)
}

func (a *App) RestoreFromBackup(backup models.BackupData) error {
    return a.setupService.SetupFromBackup(a.ctx, &backup)
}

func (a *App) GetSetupDefaults() *models.SetupDefaults {
    return a.setupService.GetSetupDefaults()
}

// Certificate operations
func (a *App) GenerateCSR(req models.CSRRequest) (*models.CSRResponse, error) {
    return a.certificateService.GenerateCSR(a.ctx, req)
}

func (a *App) UploadCertificate(hostname, certPEM string) error {
    return a.certificateService.UploadCertificate(a.ctx, hostname, certPEM)
}

func (a *App) ImportCertificate(req models.ImportRequest) error {
    return a.certificateService.ImportCertificate(a.ctx, req)
}

func (a *App) ListCertificates(filter models.CertificateFilter) ([]*models.CertificateListItem, error) {
    return a.certificateService.ListCertificates(a.ctx, filter)
}

func (a *App) GetCertificate(hostname string) (*models.Certificate, error) {
    return a.certificateService.GetCertificate(a.ctx, hostname)
}

func (a *App) DeleteCertificate(hostname string) error {
    return a.certificateService.DeleteCertificate(a.ctx, hostname)
}

// Download operations (with file dialogs)
func (a *App) SaveCSRToFile(hostname string) error {
    csr, err := a.certificateService.GetCSRForDownload(a.ctx, hostname)
    if err != nil {
        return err
    }
    
    path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
        DefaultFilename: hostname + ".csr",
        Filters: []runtime.FileFilter{
            {DisplayName: "CSR Files (*.csr)", Pattern: "*.csr"},
            {DisplayName: "PEM Files (*.pem)", Pattern: "*.pem"},
        },
    })
    
    if err != nil || path == "" {
        return err
    }
    
    return os.WriteFile(path, []byte(csr), 0600)
}

func (a *App) SaveCertificateToFile(hostname string) error {
    cert, err := a.certificateService.GetCertificateForDownload(a.ctx, hostname)
    if err != nil {
        return err
    }
    
    path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
        DefaultFilename: hostname + ".crt",
        Filters: []runtime.FileFilter{
            {DisplayName: "Certificate Files (*.crt)", Pattern: "*.crt"},
            {DisplayName: "PEM Files (*.pem)", Pattern: "*.pem"},
        },
    })
    
    if err != nil || path == "" {
        return err
    }
    
    return os.WriteFile(path, []byte(cert), 0644)
}

func (a *App) SavePrivateKeyToFile(hostname string) error {
    key, err := a.certificateService.GetPrivateKeyForDownload(a.ctx, hostname)
    if err != nil {
        return err
    }
    
    path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
        DefaultFilename: hostname + ".key",
        Filters: []runtime.FileFilter{
            {DisplayName: "Key Files (*.key)", Pattern: "*.key"},
            {DisplayName: "PEM Files (*.pem)", Pattern: "*.pem"},
        },
    })
    
    if err != nil || path == "" {
        return err
    }
    
    return os.WriteFile(path, []byte(key), 0600)
}

// Backup operations
func (a *App) ExportBackup(includeKeys bool) error {
    backup, err := a.backupService.ExportBackup(a.ctx, includeKeys)
    if err != nil {
        return err
    }
    
    path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
        DefaultFilename: fmt.Sprintf("paddockcontrol-backup-%d.json", time.Now().Unix()),
        Filters: []runtime.FileFilter{
            {DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
        },
    })
    
    if err != nil || path == "" {
        return err
    }
    
    data, err := json.MarshalIndent(backup, "", "  ")
    if err != nil {
        return err
    }
    
    return os.WriteFile(path, data, 0600)
}

func (a *App) ImportBackup() (*models.ImportResult, error) {
    path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
        Title: "Select Backup File",
        Filters: []runtime.FileFilter{
            {DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
        },
    })
    
    if err != nil || path == "" {
        return nil, err
    }
    
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, err
    }
    
    var backup models.BackupData
    if err := json.Unmarshal(data, &backup); err != nil {
        return nil, err
    }
    
    return a.backupService.ImportBackup(a.ctx, &backup)
}

// Utility methods
func (a *App) CopyToClipboard(text string) error {
    return runtime.ClipboardSetText(a.ctx, text)
}

func (a *App) ShowNotification(title, message string) {
    runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
        Type:    runtime.InfoDialog,
        Title:   title,
        Message: message,
    })
}

func (a *App) GetAppVersion() string {
    return "0.1.0" // TODO: Inject via build
}
```

**Tasks**:
- [ ] Create App struct with service dependencies
- [ ] Implement startup/shutdown lifecycle
- [ ] Add OS-specific data directory resolution
- [ ] Implement encryption key prompt flow
- [ ] Wire up all certificate methods
- [ ] Wire up download methods with file dialogs
- [ ] Wire up backup/restore with file dialogs
- [ ] Wire up setup methods
- [ ] Add utility methods (clipboard, notifications)
- [ ] Test all bindings

---

### Phase 4: Frontend - Complete Rework
**Priority**: High  
**Strategy**: Build from scratch with modern React

**NOTE**: Frontend implementation will be reviewed when preparing this phase. Key aspects:

1. **Encryption Key Dialog**: First screen on startup
2. **Setup Flow**: Restore-or-configure choice if not configured
3. **Dashboard**: Certificate list with computed status
4. **All Operations**: CSR, Upload, Import, Renewal, etc.

**Defer detailed planning until Phase 4 implementation begins.**

**High-level structure**:
```
frontend/src/
├── App.tsx                  # Main app with routing
├── main.tsx
├── index.css
├── components/
│   ├── layout/              # AppShell, Sidebar, Header
│   ├── ui/                  # shadcn/ui components
│   ├── certificate/         # Certificate-specific components
│   └── shared/              # Reusable components
├── pages/
│   ├── EncryptionKeyPrompt.tsx    # NEW: Key entry on startup
│   ├── SetupChoice.tsx            # NEW: Restore or Configure
│   ├── SetupWizard.tsx
│   ├── RestoreFromBackup.tsx      # NEW: Restore flow
│   ├── Dashboard.tsx
│   ├── CertificateDetails.tsx
│   ├── CSRForm.tsx
│   ├── CertificateUpload.tsx
│   ├── CertificateImport.tsx
│   └── Settings.tsx
├── lib/
│   ├── api.ts               # Wails bindings wrapper
│   └── utils.ts
├── stores/
│   ├── useAppStore.ts       # App state (encryption key status)
│   ├── useCertificateStore.ts
│   └── useConfigStore.ts
└── types/
    └── index.ts
```

---

## Testing Strategy

### Backend Testing
- **Copy test files from webapp** for all ported code
- Unit tests for crypto operations
- Unit tests for database operations
- Integration tests for services
- Manual testing via Wails dev mode

### Frontend Testing
- Component tests for critical UI (React Testing Library)
- Manual testing of all workflows
- Cross-platform testing (Windows, macOS, Linux)

**Tasks**:
- [ ] Copy test files from webapp for crypto layer
- [ ] Copy test files from webapp for handlers (adapt for services)
- [ ] Copy test files from webapp for database queries
- [ ] Write new tests for desktop-specific features
- [ ] Set up frontend testing infrastructure

---

## Key Decisions & Changes

### 1. Encryption Key Management
- ❌ NOT stored in environment variable
- ✅ User provides at each app startup
- ✅ Kept in memory for session duration
- ✅ Never persisted to disk
- ⚠️ If user forgets key → encrypted private keys unrecoverable

### 2. Configuration Flag
- ❌ NOT computed from database content
- ✅ Stored in `config.is_configured` column
- ✅ Set to 1 after first setup completion
- ✅ Checked on startup to determine flow

### 3. Certificate Status
- ❌ NOT stored in database
- ✅ Computed dynamically based on:
  - Has certificate PEM? → Active/Expiring/Expired
  - Has pending CSR only? → Pending
- ✅ Computed on every query
- ✅ Filtered in application layer

### 4. First Run Flow
- ✅ Prompt for encryption key (always required)
- ✅ Check `is_configured` flag
- ✅ If false: Offer "Restore from Backup" OR "Configure from Scratch"
  - If restoring: Encryption key can be in backup (optional), ask user if not present
  - If configuring: No CA Root URL needed (chain built from AIA extension)
- ✅ If true: Navigate to dashboard

### 5. Test Migration
- ✅ Copy test files from webapp for ported backend code
- ✅ Adapt handler tests for service layer
- ✅ Maintain test coverage for business logic

### 6. Backup File Compatibility
- ✅ Webapp backup files will be provided for testing import
- ✅ Backup may or may not contain encrypted keys
- ✅ Encryption key validation only if keys present in backup
- ✅ Desktop app should handle both cases gracefully

---

## Work Process

### Development Workflow
1. ✅ Work on `main` branch (no dedicated feature branch)
2. Implement phases incrementally
3. Test after each component
4. Commit frequently with clear messages

### Commit Strategy
- Small, focused commits
- Clear commit messages describing changes
- Test before committing
- Keep main branch stable

---

## Success Criteria

### Phase 1 Complete When:
- ✅ Database layer works with new schema
- ✅ Crypto layer copied and tests pass
- ✅ Config service reads from DB
- ✅ Models have proper JSON tags
- ✅ Status computation works correctly

### Phase 2 Complete When:
- ✅ Certificate service extracts all operations
- ✅ Backup service handles export/import
- ✅ Setup service reviewed and implemented
- ✅ All service tests pass

### Phase 3 Complete When:
- ✅ App initializes correctly
- ✅ Encryption key prompt works
- ✅ All methods bound to Wails
- ✅ File dialogs work on all platforms
- ✅ Services accessible from frontend

### Phase 4 Complete When:
- ✅ Encryption key entry works
- ✅ Setup flow (restore or configure) works
- ✅ Dashboard displays certificates
- ✅ All certificate operations work
- ✅ UI is polished and responsive

### MVP Complete When:
- ✅ All phases complete
- ✅ Full workflow tested end-to-end
- ✅ Builds on Windows, macOS, Linux
- ✅ Documentation updated

---

## Testing with Webapp Backup File

### Backup File Availability
- ✅ Webapp backup file will be provided when import method is implemented
- ✅ Use this file to test backup restore functionality
- ✅ Verify compatibility between webapp and desktop formats

### Test Scenarios
1. **Backup with encrypted keys**
   - Verify encryption key validation works
   - Test successful restore with correct key
   - Test error handling with wrong key

2. **Backup without encrypted keys**
   - Verify import works without key validation
   - Test that certificates are imported correctly
   - Verify configuration is restored

3. **Mixed scenarios**
   - Import backup with some certificates having keys
   - Test partial restore scenarios
   - Verify conflict handling for duplicate hostnames

### Implementation Checkpoint
- [ ] Implement backup import service
- [ ] Request webapp backup file for testing
- [ ] Test all backup import scenarios
- [ ] Verify encryption key handling
- [ ] Document any compatibility issues found

---

## Next Steps

1. **Start Phase 1**: Copy database layer
2. **Create migration 000004**: Desktop adaptations
3. **Copy crypto layer**: Verify tests pass
4. **Adapt config service**: Use DB flag for IsConfigured
5. **Add status computation**: Dynamic calculation
6. **Test Phase 1**: Ensure everything compiles and tests pass
7. **Continue to Phase 2**: Extract services
8. **Request webapp backup**: When ready to test backup import

---

**Document Version**: 3.0  
**Last Updated**: January 2026  
**Strategy**: Port backend + Rework frontend + User-supplied encryption key + Computed status
