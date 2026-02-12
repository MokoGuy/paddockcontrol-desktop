-- Database schema for SQLC code generation (PaddockControl Desktop)
-- This mirrors the latest migration file
-- Key differences from webapp:
-- - status column removed (computed dynamically)
-- - is_configured flag added to config table

-- Create certificates table
-- Metadata fields (sans, org, city, state, country, key_size) are computed from certificate or CSR, not stored
-- CSR is stored in pending_csr_pem (unified for both new CSRs and renewals)
-- Status is computed dynamically based on certificate/CSR presence
CREATE TABLE certificates (
    hostname TEXT PRIMARY KEY NOT NULL,
    encrypted_private_key BLOB,
    pending_csr_pem TEXT,
    certificate_pem TEXT,
    pending_encrypted_private_key BLOB,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER,
    last_modified INTEGER NOT NULL DEFAULT (unixepoch()),
    note TEXT,
    pending_note TEXT,
    read_only INTEGER NOT NULL DEFAULT 0
);

-- Create indexes for common queries
CREATE INDEX idx_certificates_expires_at ON certificates(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_certificates_created_at ON certificates(created_at);

-- Create config table
CREATE TABLE config (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    owner_email TEXT NOT NULL,
    ca_name TEXT NOT NULL,
    hostname_suffix TEXT NOT NULL,
    validity_period_days INTEGER NOT NULL DEFAULT 365,
    default_organization TEXT NOT NULL,
    default_organizational_unit TEXT,
    default_city TEXT NOT NULL,
    default_state TEXT NOT NULL,
    default_country TEXT NOT NULL CHECK(length(default_country) = 2),
    default_key_size INTEGER NOT NULL DEFAULT 4096 CHECK(default_key_size >= 2048),
    is_configured INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_modified INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Enforce single config row
CREATE TRIGGER enforce_single_config_row
BEFORE INSERT ON config
WHEN (SELECT COUNT(*) FROM config) >= 1
BEGIN
    SELECT RAISE(FAIL, 'Only one configuration row allowed');
END;

-- Create certificate_history table for activity logging
CREATE TABLE certificate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hostname TEXT NOT NULL,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (hostname) REFERENCES certificates(hostname) ON DELETE CASCADE
);

-- Create indexes for efficient queries
CREATE INDEX idx_certificate_history_hostname ON certificate_history(hostname);
CREATE INDEX idx_certificate_history_created_at ON certificate_history(created_at);

-- Create update_history table for tracking application updates
CREATE TABLE update_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_version TEXT NOT NULL,
    to_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'rolled_back')),
    error_message TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_update_history_created_at ON update_history(created_at);

-- Create security_keys table for multi-method master key wrapping
CREATE TABLE security_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    method TEXT NOT NULL CHECK(method IN ('password', 'os_native', 'fido2')),
    label TEXT NOT NULL,
    wrapped_master_key BLOB NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_used_at INTEGER
);
CREATE INDEX idx_security_keys_method ON security_keys(method);
