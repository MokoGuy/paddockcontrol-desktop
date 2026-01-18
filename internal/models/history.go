package models

// HistoryEntry represents a single activity log entry for a certificate
type HistoryEntry struct {
	ID        int64  `json:"id"`
	Hostname  string `json:"hostname"`
	EventType string `json:"event_type"`
	Message   string `json:"message"`
	CreatedAt int64  `json:"created_at"`
}

// Event type constants
const (
	EventCSRGenerated          = "csr_generated"
	EventCSRRegenerated        = "csr_regenerated"
	EventCertificateUploaded   = "certificate_uploaded"
	EventCertificateImported   = "certificate_imported"
	EventCertificateRestored   = "certificate_restored"
	EventCertificateDeleted    = "certificate_deleted"
	EventReadOnlyEnabled       = "readonly_enabled"
	EventReadOnlyDisabled      = "readonly_disabled"
)
