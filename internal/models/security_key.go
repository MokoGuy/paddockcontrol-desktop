package models

// SecurityKeyMethod constants for unlock method types.
// (The DB CHECK still allows the deprecated "os_native" value, but the app no
// longer uses it — only password and passkey/FIDO2.)
const (
	SecurityKeyMethodPassword = "password"
	SecurityKeyMethodFIDO2    = "fido2"
)

// SecurityKeyInfo is the frontend-safe representation of a security key.
// It intentionally excludes the wrapped master key.
type SecurityKeyInfo struct {
	ID         int64  `json:"id"`
	Method     string `json:"method"`
	Label      string `json:"label"`
	CreatedAt  int64  `json:"created_at"`
	LastUsedAt *int64 `json:"last_used_at,omitempty"`
}

// PasswordMetadata holds Argon2id parameters stored as JSON in the security_keys.metadata column.
type PasswordMetadata struct {
	Salt             []byte `json:"salt"`
	Argon2Memory     uint32 `json:"argon2_memory"`
	Argon2Iterations uint32 `json:"argon2_iterations"`
	Argon2Parallelism uint8 `json:"argon2_parallelism"`
}

// WebAuthnMetadata holds the data needed to re-derive a passkey's PRF secret,
// stored as JSON in security_keys.metadata for the "fido2" method. The
// credential is non-resident, so we hold its id and the PRF salt here.
type WebAuthnMetadata struct {
	CredentialID []byte `json:"credential_id"`
	Salt         []byte `json:"salt"`
}
