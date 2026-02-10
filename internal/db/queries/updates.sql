-- Update history queries

-- name: RecordUpdate :exec
-- Record an update attempt (success or failure)
INSERT INTO update_history (from_version, to_version, status, error_message)
VALUES (?, ?, ?, ?);

-- name: GetUpdateHistory :many
-- Get recent update history entries, newest first
SELECT id, from_version, to_version, status, error_message, created_at
FROM update_history
ORDER BY created_at DESC
LIMIT ?;
