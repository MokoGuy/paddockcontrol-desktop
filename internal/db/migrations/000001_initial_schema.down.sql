-- Rollback initial database schema

DROP TRIGGER enforce_single_config_row;
DROP TABLE config;
DROP INDEX idx_certificates_created_at;
DROP INDEX idx_certificates_expires_at;
DROP TABLE certificates;
