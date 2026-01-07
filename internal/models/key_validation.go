package models

// KeyValidationResult represents the result of validating an encryption key
type KeyValidationResult struct {
	Valid           bool     `json:"valid"`
	FailedHostnames []string `json:"failed_hostnames,omitempty"`
}
