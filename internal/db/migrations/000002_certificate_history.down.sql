-- Drop certificate_history table and indexes
DROP INDEX IF EXISTS idx_certificate_history_created_at;
DROP INDEX IF EXISTS idx_certificate_history_hostname;
DROP TABLE IF EXISTS certificate_history;
