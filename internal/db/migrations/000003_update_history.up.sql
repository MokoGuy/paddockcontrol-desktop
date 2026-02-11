CREATE TABLE update_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_version TEXT NOT NULL,
    to_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'rolled_back')),
    error_message TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_update_history_created_at ON update_history(created_at);
