-- name: CreateCertificate :exec
-- Create a new certificate entry with all fields
INSERT INTO certificates (
    hostname,
    encrypted_private_key,
    pending_encrypted_private_key,
    pending_csr_pem,
    certificate_pem,
    expires_at,
    note,
    pending_note,
    read_only
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: GetCertificateByHostname :one
-- Get a certificate by hostname
SELECT * FROM certificates WHERE hostname = ? LIMIT 1;

-- name: ListAllCertificates :many
-- List all certificates ordered by creation date
SELECT * FROM certificates
ORDER BY created_at DESC;

-- name: UpdatePendingCSR :exec
-- Store or update pending CSR and key (unified for initial generation or renewal)
UPDATE certificates
SET pending_csr_pem = ?,
    pending_encrypted_private_key = ?,
    pending_note = ?,
    last_modified = unixepoch('now')
WHERE hostname = ?;

-- name: ActivateCertificate :exec
-- Activate certificate after upload (unified for initial or renewal)
-- Move pending key to active column, store certificate, clear pending columns
UPDATE certificates
SET encrypted_private_key = pending_encrypted_private_key,
    certificate_pem = ?,
    pending_csr_pem = NULL,
    pending_encrypted_private_key = NULL,
    pending_note = NULL,
    expires_at = ?,
    last_modified = unixepoch('now')
WHERE hostname = ?;

-- name: DeleteCertificate :exec
-- Delete a certificate
DELETE FROM certificates WHERE hostname = ?;

-- name: DeleteAllCertificates :exec
-- Delete all certificates
DELETE FROM certificates;

-- name: CertificateExists :one
-- Check if certificate exists by hostname
SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END AS cert_exists FROM certificates WHERE hostname = ?;

-- name: UpdateCertificateNote :exec
-- Update the note field for a certificate
UPDATE certificates
SET note = ?,
    last_modified = unixepoch('now')
WHERE hostname = ?;

-- name: ClearPendingCSR :exec
-- Clear pending CSR and pending key without deleting the certificate
UPDATE certificates
SET pending_csr_pem = NULL,
    pending_encrypted_private_key = NULL,
    pending_note = NULL,
    last_modified = unixepoch('now')
WHERE hostname = ?;

-- name: UpdatePendingNote :exec
-- Update the pending note field
UPDATE certificates
SET pending_note = ?,
    last_modified = unixepoch('now')
WHERE hostname = ?;

-- name: UpdateCertificateReadOnly :exec
-- Mark certificate as read-only
UPDATE certificates
SET read_only = ?,
    last_modified = unixepoch('now')
WHERE hostname = ?;

-- name: RestoreCertificate :exec
-- Restore a complete certificate from backup in a single operation
INSERT INTO certificates (
    hostname,
    encrypted_private_key,
    pending_encrypted_private_key,
    pending_csr_pem,
    certificate_pem,
    created_at,
    expires_at,
    last_modified,
    note,
    pending_note,
    read_only
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(hostname) DO UPDATE SET
    encrypted_private_key = excluded.encrypted_private_key,
    pending_encrypted_private_key = excluded.pending_encrypted_private_key,
    pending_csr_pem = excluded.pending_csr_pem,
    certificate_pem = excluded.certificate_pem,
    expires_at = excluded.expires_at,
    last_modified = excluded.last_modified,
    note = excluded.note,
    pending_note = excluded.pending_note,
    read_only = excluded.read_only;
