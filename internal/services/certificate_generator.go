package services

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net"
	"strings"
	"time"

	"paddockcontrol-desktop/internal/crypto"
	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"
)

// GenerateCSR generates a new Certificate Signing Request
func (s *CertificateService) GenerateCSR(ctx context.Context, req models.CSRRequest, encryptionKey []byte) (*models.CSRResponse, error) {
	ctx, log := logger.WithOperation(ctx, "generate_csr")
	log = logger.WithHostname(log, req.Hostname)
	log.Info("starting CSR generation",
		slog.Int("key_size", req.KeySize),
		slog.Bool("is_renewal", req.IsRenewal),
		slog.Int("san_count", len(req.SANs)),
	)

	start := time.Now()

	// Validate hostname (with optional bypass for admin mode)
	t := time.Now()
	if err := s.validateHostname(ctx, req.Hostname, req.SkipSuffixValidation); err != nil {
		log.Error("hostname validation failed", logger.Err(err))
		return nil, err
	}
	log.Debug("profile: validateHostname", slog.Duration("duration", time.Since(t)))

	// Check for duplicates
	t = time.Now()
	exists, err := s.db.Queries().CertificateExists(ctx, req.Hostname)
	if err != nil {
		log.Error("failed to check certificate existence", logger.Err(err))
		return nil, fmt.Errorf("failed to check certificate existence: %w", err)
	}
	log.Debug("profile: CertificateExists", slog.Duration("duration", time.Since(t)))

	if exists == 1 && !req.IsRenewal {
		log.Warn("certificate already exists", slog.String("hostname", req.Hostname))
		return nil, fmt.Errorf("certificate already exists for hostname: %s", req.Hostname)
	}

	// Process SANs into DNS and IP categories
	t = time.Now()
	dnsSANs, ipSANs, err := s.processSANEntries(req.SANs)
	if err != nil {
		log.Error("invalid SAN entry", logger.Err(err))
		return nil, fmt.Errorf("invalid SAN entry: %w", err)
	}
	log.Debug("profile: processSANEntries",
		slog.Duration("duration", time.Since(t)),
		slog.Int("dns_sans", len(dnsSANs)),
		slog.Int("ip_sans", len(ipSANs)),
	)

	// Generate RSA key pair
	t = time.Now()
	privateKey, err := crypto.GenerateRSAKey(req.KeySize)
	if err != nil {
		log.Error("failed to generate RSA key", logger.Err(err))
		return nil, fmt.Errorf("failed to generate RSA key: %w", err)
	}
	log.Debug("profile: GenerateRSAKey",
		slog.Duration("duration", time.Since(t)),
		slog.Int("key_size", req.KeySize),
	)

	// Convert CSRRequest to crypto.CSRRequest
	csrReq := crypto.CSRRequest{
		CommonName:         req.Hostname,
		Organization:       req.Organization,
		OrganizationalUnit: req.OrganizationalUnit,
		City:               req.City,
		State:              req.State,
		Country:            req.Country,
		DNSSANs:            dnsSANs,
		IPSANs:             ipSANs,
	}

	// Create CSR
	t = time.Now()
	csrPEM, err := crypto.CreateCSR(csrReq, privateKey)
	if err != nil {
		log.Error("failed to create CSR", logger.Err(err))
		return nil, fmt.Errorf("failed to create CSR: %w", err)
	}
	log.Debug("profile: CreateCSR", slog.Duration("duration", time.Since(t)))

	// Convert private key to PEM
	t = time.Now()
	keyPEM, err := crypto.PrivateKeyToPEM(privateKey)
	if err != nil {
		log.Error("failed to encode private key", logger.Err(err))
		return nil, fmt.Errorf("failed to encode private key: %w", err)
	}
	log.Debug("profile: PrivateKeyToPEM", slog.Duration("duration", time.Since(t)))

	// Encrypt private key
	t = time.Now()
	encryptedKey, err := crypto.EncryptPrivateKey(keyPEM, string(encryptionKey))
	if err != nil {
		log.Error("failed to encrypt private key", logger.Err(err))
		return nil, fmt.Errorf("failed to encrypt private key: %w", err)
	}
	log.Debug("profile: EncryptPrivateKey", slog.Duration("duration", time.Since(t)))

	// Store in database
	t = time.Now()
	if req.IsRenewal {
		// Update existing certificate with pending renewal
		err = s.db.Queries().UpdatePendingCSR(ctx, sqlc.UpdatePendingCSRParams{
			Hostname:                   req.Hostname,
			PendingCsrPem:              sql.NullString{String: string(csrPEM), Valid: true},
			PendingEncryptedPrivateKey: encryptedKey,
			PendingNote:                sql.NullString{String: req.Note, Valid: req.Note != ""},
		})
	} else {
		// Create new certificate record
		err = s.db.Queries().CreateCertificate(ctx, sqlc.CreateCertificateParams{
			Hostname:            req.Hostname,
			EncryptedPrivateKey: encryptedKey,
			PendingCsrPem:       sql.NullString{String: string(csrPEM), Valid: true},
			Note:                sql.NullString{String: req.Note, Valid: req.Note != ""},
			ReadOnly:            0,
		})
	}
	log.Debug("profile: Database write", slog.Duration("duration", time.Since(t)))

	if err != nil {
		log.Error("failed to store CSR", logger.Err(err))
		return nil, fmt.Errorf("failed to store CSR: %w", err)
	}

	// Log history entry
	eventType := models.EventCSRGenerated
	message := fmt.Sprintf("CSR generated (%d-bit key, %d SANs)", req.KeySize, len(req.SANs))
	if req.IsRenewal {
		eventType = models.EventCSRRegenerated
		message = fmt.Sprintf("CSR regenerated for renewal (%d-bit key, %d SANs)", req.KeySize, len(req.SANs))
	}
	if err := s.history.LogEvent(ctx, req.Hostname, eventType, message); err != nil {
		log.Warn("failed to log history entry", logger.Err(err))
		// Don't fail the operation for history logging errors
	}

	log.Info("CSR generated successfully",
		slog.Duration("total_duration", time.Since(start)),
		slog.Int("csr_size", len(csrPEM)),
	)

	return &models.CSRResponse{
		Hostname: req.Hostname,
		CSR:      string(csrPEM),
		Message:  "CSR generated successfully",
	}, nil
}

// validateHostname validates the hostname against configuration
func (s *CertificateService) validateHostname(ctx context.Context, hostname string, skipSuffixValidation bool) error {
	if hostname == "" {
		return fmt.Errorf("hostname cannot be empty")
	}

	// Skip suffix validation if requested (admin bypass)
	if skipSuffixValidation {
		return nil
	}

	cfg, err := s.config.GetConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to get configuration: %w", err)
	}

	if cfg != nil && cfg.HostnameSuffix != "" {
		if !strings.HasSuffix(hostname, cfg.HostnameSuffix) {
			return fmt.Errorf("hostname must end with %s", cfg.HostnameSuffix)
		}
	}

	return nil
}

// processSANEntries converts SANEntry slice to separate DNS and IP SAN slices
func (s *CertificateService) processSANEntries(entries []models.SANEntry) ([]string, []net.IP, error) {
	var dnsSANs []string
	var ipSANs []net.IP

	for _, entry := range entries {
		switch entry.Type {
		case models.SANTypeDNS:
			dnsSANs = append(dnsSANs, entry.Value)
		case models.SANTypeIP:
			ip := net.ParseIP(entry.Value)
			if ip == nil {
				return nil, nil, fmt.Errorf("invalid IP address: %s", entry.Value)
			}
			ipSANs = append(ipSANs, ip)
		default:
			return nil, nil, fmt.Errorf("unknown SAN type: %s", entry.Type)
		}
	}

	return dnsSANs, ipSANs, nil
}
