-- name: GetConfig :one
-- Get the configuration (single row)
SELECT id, owner_email, ca_name, hostname_suffix, validity_period_days,
       default_organization, default_organizational_unit,
       default_city, default_state, default_country, default_key_size,
       is_configured,
       created_at, last_modified
FROM config WHERE id = 1 LIMIT 1;

-- name: ConfigExists :one
-- Check if configuration exists
SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END AS config_exists FROM config WHERE id = 1;

-- name: CreateConfig :exec
-- Create the initial configuration
INSERT INTO config (
    id, owner_email, ca_name, hostname_suffix, validity_period_days,
    default_organization, default_organizational_unit,
    default_city, default_state, default_country, default_key_size
) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateConfig :exec
-- Update configuration (preserves is_configured flag)
UPDATE config
SET owner_email = ?,
    ca_name = ?,
    hostname_suffix = ?,
    validity_period_days = ?,
    default_organization = ?,
    default_organizational_unit = ?,
    default_city = ?,
    default_state = ?,
    default_country = ?,
    default_key_size = ?,
    last_modified = unixepoch('now')
WHERE id = 1;

-- name: IsConfigured :one
-- Check if initial setup is complete
SELECT is_configured FROM config WHERE id = 1 LIMIT 1;

-- name: SetConfigured :exec
-- Mark setup as complete
UPDATE config
SET is_configured = 1,
    last_modified = unixepoch('now')
WHERE id = 1;
