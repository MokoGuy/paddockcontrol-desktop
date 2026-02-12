-- name: ListSecurityKeys :many
-- List all security keys ordered by creation date
SELECT id, method, label, wrapped_master_key, metadata, created_at, last_used_at
FROM security_keys
ORDER BY created_at ASC;

-- name: GetSecurityKeysByMethod :many
-- Get security keys filtered by method type
SELECT id, method, label, wrapped_master_key, metadata, created_at, last_used_at
FROM security_keys
WHERE method = ?
ORDER BY created_at ASC;

-- name: GetSecurityKeyByID :one
-- Get a single security key by ID
SELECT id, method, label, wrapped_master_key, metadata, created_at, last_used_at
FROM security_keys
WHERE id = ?;

-- name: InsertSecurityKey :one
-- Insert a new security key and return the created row
INSERT INTO security_keys (method, label, wrapped_master_key, metadata)
VALUES (?, ?, ?, ?)
RETURNING id, method, label, wrapped_master_key, metadata, created_at, last_used_at;

-- name: UpdateSecurityKeyLastUsed :exec
-- Update the last_used_at timestamp for a security key
UPDATE security_keys
SET last_used_at = unixepoch()
WHERE id = ?;

-- name: DeleteSecurityKey :exec
-- Delete a security key by ID
DELETE FROM security_keys WHERE id = ?;

-- name: CountSecurityKeysByMethod :one
-- Count security keys of a specific method
SELECT COUNT(*) AS count FROM security_keys WHERE method = ?;

-- name: CountAllSecurityKeys :one
-- Count all security keys
SELECT COUNT(*) AS count FROM security_keys;

-- name: HasAnySecurityKeys :one
-- Check if any security keys exist
SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END AS has_keys FROM security_keys;

-- name: DeleteSecurityKeysByMethod :exec
-- Delete all security keys of a specific method
DELETE FROM security_keys WHERE method = ?;
