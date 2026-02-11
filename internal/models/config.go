package models

// Config represents the application configuration
type Config struct {
	ID                        int    `json:"id"`
	OwnerEmail                string `json:"owner_email"`
	CAName                    string `json:"ca_name"`
	HostnameSuffix            string `json:"hostname_suffix"`
	ValidityPeriodDays        int    `json:"validity_period_days"`
	DefaultOrganization       string `json:"default_organization"`
	DefaultOrganizationalUnit string `json:"default_organizational_unit,omitempty"`
	DefaultCity               string `json:"default_city"`
	DefaultState              string `json:"default_state"`
	DefaultCountry            string `json:"default_country"`
	DefaultKeySize            int    `json:"default_key_size"`
	IsConfigured              int    `json:"is_configured"`
	CreatedAt                 int64  `json:"created_at"`
	LastModified              int64  `json:"last_modified"`
}

// SetupRequest represents a request to configure the application
type SetupRequest struct {
	OwnerEmail                string `json:"owner_email"`
	CAName                    string `json:"ca_name"`
	HostnameSuffix            string `json:"hostname_suffix"`
	ValidityPeriodDays        int    `json:"validity_period_days"`
	DefaultOrganization       string `json:"default_organization"`
	DefaultOrganizationalUnit string `json:"default_organizational_unit,omitempty"`
	DefaultCity               string `json:"default_city"`
	DefaultState              string `json:"default_state"`
	DefaultCountry            string `json:"default_country"`
	DefaultKeySize            int    `json:"default_key_size"`
}

// UpdateConfigRequest represents a request to update the application configuration
type UpdateConfigRequest struct {
	OwnerEmail                string `json:"owner_email"`
	CAName                    string `json:"ca_name"`
	HostnameSuffix            string `json:"hostname_suffix"`
	ValidityPeriodDays        int    `json:"validity_period_days"`
	DefaultOrganization       string `json:"default_organization"`
	DefaultOrganizationalUnit string `json:"default_organizational_unit,omitempty"`
	DefaultCity               string `json:"default_city"`
	DefaultState              string `json:"default_state"`
	DefaultCountry            string `json:"default_country"`
	DefaultKeySize            int    `json:"default_key_size"`
}

// SetupDefaults represents default values for setup form
type SetupDefaults struct {
	ValidityPeriodDays        int    `json:"validity_period_days"`
	DefaultKeySize            int    `json:"default_key_size"`
	DefaultCountry            string `json:"default_country"`
	DefaultOrganization       string `json:"default_organization"`
	DefaultOrganizationalUnit string `json:"default_organizational_unit,omitempty"`
	DefaultCity               string `json:"default_city"`
	DefaultState              string `json:"default_state"`
}
