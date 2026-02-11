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
