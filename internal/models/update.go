package models

// UpdateInfo contains version comparison and release metadata
type UpdateInfo struct {
	CurrentVersion  string `json:"current_version"`
	LatestVersion   string `json:"latest_version"`
	ReleaseURL      string `json:"release_url"`
	ReleaseNotes    string `json:"release_notes"`
	PublishedAt     string `json:"published_at"`
	AssetSize       int64  `json:"asset_size"`
	UpdateAvailable bool   `json:"update_available"`
}

// UpdateHistoryEntry represents a recorded update attempt
type UpdateHistoryEntry struct {
	ID           int64  `json:"id"`
	FromVersion  string `json:"from_version"`
	ToVersion    string `json:"to_version"`
	Status       string `json:"status"`
	ErrorMessage string `json:"error_message,omitempty"`
	CreatedAt    int64  `json:"created_at"`
}
