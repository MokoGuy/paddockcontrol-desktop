package models

// Certificate represents a certificate with its complete metadata
// Fields marked as computed are not stored in the database
type Certificate struct {
	Hostname            string `json:"hostname"`
	EncryptedKey        []byte `json:"-"` // Never expose to frontend
	PendingCSR          string `json:"pending_csr,omitempty"`
	CertificatePEM      string `json:"certificate_pem,omitempty"`
	PendingEncryptedKey []byte `json:"-"` // Never expose to frontend
	CreatedAt           int64  `json:"created_at"`
	ExpiresAt           *int64 `json:"expires_at,omitempty"`
	Note                string `json:"note,omitempty"`
	PendingNote         string `json:"pending_note,omitempty"`
	ReadOnly            bool   `json:"read_only"`

	// Computed fields (not in DB, calculated at runtime)
	Status              string   `json:"status"` // pending, active, expiring, expired
	SANs                []string `json:"sans,omitempty"`
	Organization        string   `json:"organization,omitempty"`
	OrganizationalUnit  string   `json:"organizational_unit,omitempty"`
	City                string   `json:"city,omitempty"`
	State               string   `json:"state,omitempty"`
	Country             string   `json:"country,omitempty"`
	KeySize             int      `json:"key_size,omitempty"`
	DaysUntilExpiration int      `json:"days_until_expiration,omitempty"`

	// Computed fields from pending CSR (when both cert and CSR exist, for regenerate functionality)
	PendingSANs               []string `json:"pending_sans,omitempty"`
	PendingOrganization       string   `json:"pending_organization,omitempty"`
	PendingOrganizationalUnit string   `json:"pending_organizational_unit,omitempty"`
	PendingCity               string   `json:"pending_city,omitempty"`
	PendingState              string   `json:"pending_state,omitempty"`
	PendingCountry            string   `json:"pending_country,omitempty"`
	PendingKeySize            int      `json:"pending_key_size,omitempty"`
}

// CertificateListItem represents a certificate in a list view
type CertificateListItem struct {
	Hostname            string   `json:"hostname"`
	Status              string   `json:"status"` // computed
	SANs                []string `json:"sans,omitempty"`
	KeySize             int      `json:"key_size,omitempty"`
	CreatedAt           int64    `json:"created_at"`
	ExpiresAt           *int64   `json:"expires_at,omitempty"`
	DaysUntilExpiration int      `json:"days_until_expiration,omitempty"`
	ReadOnly            bool     `json:"read_only"`
	HasPendingCSR       bool     `json:"has_pending_csr"`
}

// SANType constants for Subject Alternative Name types
const (
	SANTypeDNS = "dns"
	SANTypeIP  = "ip"
)

// SANEntry represents a typed Subject Alternative Name entry
type SANEntry struct {
	Value string `json:"value"`
	Type  string `json:"type"` // "dns", "ipv4", "ipv6"
}

// CSRRequest represents a request to generate a certificate signing request
type CSRRequest struct {
	Hostname             string     `json:"hostname"`
	SANs                 []SANEntry `json:"sans,omitempty"`
	Organization         string     `json:"organization"`
	OrganizationalUnit   string     `json:"organizational_unit,omitempty"`
	City                 string     `json:"city"`
	State                string     `json:"state"`
	Country              string     `json:"country"`
	KeySize              int        `json:"key_size"`
	Note                 string     `json:"note,omitempty"`
	IsRenewal            bool       `json:"is_renewal,omitempty"`
	SkipSuffixValidation bool       `json:"skip_suffix_validation,omitempty"`
}

// CSRResponse represents the response from CSR generation
type CSRResponse struct {
	Hostname string `json:"hostname"`
	CSR      string `json:"csr"`
	Message  string `json:"message"`
}

// ImportRequest represents a request to import a certificate with its private key
type ImportRequest struct {
	CertificatePEM string `json:"certificate_pem"`
	PrivateKeyPEM  string `json:"private_key_pem"`
	CertChainPEM   string `json:"cert_chain_pem,omitempty"`
	Note           string `json:"note,omitempty"`
}

// CertificateFilter represents filtering options for certificate listings
type CertificateFilter struct {
	Status    string `json:"status,omitempty"`     // all, pending, active, expiring, expired
	SortBy    string `json:"sort_by,omitempty"`    // created, expiring, hostname
	SortOrder string `json:"sort_order,omitempty"` // asc, desc
}

// BackupCertificate represents a certificate in a backup file
type BackupCertificate struct {
	Hostname            string `json:"hostname"`
	EncryptedKey        []byte `json:"encrypted_private_key,omitempty"`
	PendingCSR          string `json:"pending_csr_pem,omitempty"`
	CertificatePEM      string `json:"certificate_pem,omitempty"`
	PendingEncryptedKey []byte `json:"pending_encrypted_private_key,omitempty"`
	CreatedAt           int64  `json:"created_at"`
	ExpiresAt           *int64 `json:"expires_at,omitempty"`
	Note                string `json:"note,omitempty"`
	PendingNote         string `json:"pending_note,omitempty"`
	ReadOnly            bool   `json:"read_only"`
}

// BackupData represents the complete backup file structure
type BackupData struct {
	Version       string               `json:"version"`
	ExportedAt    int64                `json:"exported_at"`
	EncryptionKey string               `json:"encryption_key,omitempty"`
	Config        *Config              `json:"config,omitempty"`
	Certificates  []*BackupCertificate `json:"certificates,omitempty"`
}

// ImportResult represents the result of importing a backup
type ImportResult struct {
	Success   int      `json:"success"`
	Skipped   int      `json:"skipped"`
	Failed    int      `json:"failed"`
	Conflicts []string `json:"conflicts,omitempty"`
}

// BackupValidationResult represents validation results from a backup file
type BackupValidationResult struct {
	Valid            bool   `json:"valid"`
	Version          string `json:"version"`
	CertificateCount int    `json:"certificate_count"`
	HasEncryptedKeys bool   `json:"has_encrypted_keys"`
	HasEncryptionKey bool   `json:"has_encryption_key"`
	EncryptionKey    string `json:"encryption_key"`
	ExportedAt       int64  `json:"exported_at"`
}

// LocalBackupInfo represents metadata about a local database backup file
type LocalBackupInfo struct {
	Filename         string `json:"filename"`                    // Full filename
	Type             string `json:"type"`                        // "auto" or "manual"
	Timestamp        int64  `json:"timestamp"`                   // Unix timestamp parsed from filename
	Size             int64  `json:"size"`                        // File size in bytes
	CertificateCount int    `json:"certificate_count"`           // Number of certificates in backup
	CAName           string `json:"ca_name,omitempty"`           // CA name from config table
}

// CertificateUploadPreview represents a preview of a signed certificate before upload
type CertificateUploadPreview struct {
	Hostname  string   `json:"hostname"`
	IssuerCN  string   `json:"issuer_cn"`
	IssuerO   string   `json:"issuer_o"`
	NotBefore int64    `json:"not_before"`
	NotAfter  int64    `json:"not_after"`
	SANs      []string `json:"sans,omitempty"`
	KeySize   int      `json:"key_size"`
	CSRMatch  bool     `json:"csr_match"`
	KeyMatch  bool     `json:"key_match"` // cert public key matches pending private key
}

// ChainCertificateInfo represents metadata for a single certificate in the chain
type ChainCertificateInfo struct {
	SubjectCN          string `json:"subject_cn"`           // Subject Common Name
	SubjectO           string `json:"subject_o"`            // Subject Organization
	IssuerCN           string `json:"issuer_cn"`            // Issuer Common Name
	IssuerO            string `json:"issuer_o"`             // Issuer Organization
	NotBeforeTimestamp int64  `json:"not_before_timestamp"` // Validity start date (Unix timestamp)
	NotAfterTimestamp  int64  `json:"not_after_timestamp"`  // Validity end date (Unix timestamp)
	SerialNumber       string `json:"serial_number"`        // Serial number (hex formatted)
	CertType           string `json:"cert_type"`            // "leaf", "intermediate", "root"
	Depth              int    `json:"depth"`                // Depth in chain (0 = leaf)
	PEM                string `json:"pem,omitempty"`        // Certificate PEM data (for export)
}
