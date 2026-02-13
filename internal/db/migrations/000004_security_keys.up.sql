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
