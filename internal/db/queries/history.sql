-- Certificate history queries

-- name: AddHistoryEntry :exec
-- Add a new history entry for a certificate
INSERT INTO certificate_history (hostname, event_type, message)
VALUES (?, ?, ?);

-- name: GetCertificateHistory :many
-- Get history entries for a certificate, ordered by most recent first
SELECT id, hostname, event_type, message, created_at
FROM certificate_history
WHERE hostname = ?
ORDER BY created_at DESC
LIMIT ?;

-- name: DeleteCertificateHistory :exec
-- Delete all history entries for a certificate (used when certificate is deleted)
DELETE FROM certificate_history WHERE hostname = ?;
