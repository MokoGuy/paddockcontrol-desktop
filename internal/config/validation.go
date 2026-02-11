package config

import (
	"fmt"
	"net/mail"
	"regexp"
	"strings"

	"paddockcontrol-desktop/internal/models"
)

var (
	// ISO 3166-1 alpha-2 country code pattern (2 uppercase letters)
	countryCodePattern = regexp.MustCompile(`^[A-Z]{2}$`)

	// Hostname suffix must start with a dot
	hostnameSuffixPattern = regexp.MustCompile(`^\.([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]{2,}$`)
)

// ValidateConfigUpdate validates an UpdateConfigRequest
func ValidateConfigUpdate(req *models.UpdateConfigRequest) error {
	if req == nil {
		return fmt.Errorf("request cannot be nil")
	}

	// Validate owner_email
	if err := validateEmail(req.OwnerEmail, "owner_email"); err != nil {
		return err
	}

	// Validate ca_name
	if err := validateRequiredString(req.CAName, "ca_name", 255); err != nil {
		return err
	}

	// Validate hostname_suffix
	if err := validateHostnameSuffix(req.HostnameSuffix); err != nil {
		return err
	}

	// Validate validity_period_days
	if err := validateValidityPeriod(req.ValidityPeriodDays); err != nil {
		return err
	}

	// Validate default_organization
	if err := validateRequiredString(req.DefaultOrganization, "default_organization", 255); err != nil {
		return err
	}

	// Validate default_organizational_unit (optional)
	if req.DefaultOrganizationalUnit != "" {
		if err := validateOptionalString(req.DefaultOrganizationalUnit, "default_organizational_unit", 255); err != nil {
			return err
		}
	}

	// Validate default_city
	if err := validateRequiredString(req.DefaultCity, "default_city", 255); err != nil {
		return err
	}

	// Validate default_state
	if err := validateRequiredString(req.DefaultState, "default_state", 255); err != nil {
		return err
	}

	// Validate default_country
	if err := validateCountryCode(req.DefaultCountry); err != nil {
		return err
	}

	// Validate default_key_size
	if err := validateKeySize(req.DefaultKeySize); err != nil {
		return err
	}

	return nil
}

// ValidateSetupRequest validates a SetupRequest (can reuse for setup wizard)
func ValidateSetupRequest(req *models.SetupRequest) error {
	if req == nil {
		return fmt.Errorf("request cannot be nil")
	}

	// Validate owner_email
	if err := validateEmail(req.OwnerEmail, "owner_email"); err != nil {
		return err
	}

	// Validate ca_name
	if err := validateRequiredString(req.CAName, "ca_name", 255); err != nil {
		return err
	}

	// Validate hostname_suffix
	if err := validateHostnameSuffix(req.HostnameSuffix); err != nil {
		return err
	}

	// Validate validity_period_days
	if err := validateValidityPeriod(req.ValidityPeriodDays); err != nil {
		return err
	}

	// Validate default_organization
	if err := validateRequiredString(req.DefaultOrganization, "default_organization", 255); err != nil {
		return err
	}

	// Validate default_organizational_unit (optional)
	if req.DefaultOrganizationalUnit != "" {
		if err := validateOptionalString(req.DefaultOrganizationalUnit, "default_organizational_unit", 255); err != nil {
			return err
		}
	}

	// Validate default_city
	if err := validateRequiredString(req.DefaultCity, "default_city", 255); err != nil {
		return err
	}

	// Validate default_state
	if err := validateRequiredString(req.DefaultState, "default_state", 255); err != nil {
		return err
	}

	// Validate default_country
	if err := validateCountryCode(req.DefaultCountry); err != nil {
		return err
	}

	// Validate default_key_size
	if err := validateKeySize(req.DefaultKeySize); err != nil {
		return err
	}

	return nil
}

// validateEmail validates an email address format
func validateEmail(email, fieldName string) error {
	if strings.TrimSpace(email) == "" {
		return fmt.Errorf("%s is required", fieldName)
	}

	if len(email) > 255 {
		return fmt.Errorf("%s must not exceed 255 characters", fieldName)
	}

	_, err := mail.ParseAddress(email)
	if err != nil {
		return fmt.Errorf("%s must be a valid email address", fieldName)
	}

	return nil
}

// validateRequiredString validates a required string field
func validateRequiredString(value, fieldName string, maxLength int) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("%s is required", fieldName)
	}

	if len(value) > maxLength {
		return fmt.Errorf("%s must not exceed %d characters", fieldName, maxLength)
	}

	return nil
}

// validateOptionalString validates an optional string field
func validateOptionalString(value, fieldName string, maxLength int) error {
	if len(value) > maxLength {
		return fmt.Errorf("%s must not exceed %d characters", fieldName, maxLength)
	}

	return nil
}

// validateHostnameSuffix validates the hostname suffix format
func validateHostnameSuffix(suffix string) error {
	if strings.TrimSpace(suffix) == "" {
		return fmt.Errorf("hostname_suffix is required")
	}

	if len(suffix) > 255 {
		return fmt.Errorf("hostname_suffix must not exceed 255 characters")
	}

	if !strings.HasPrefix(suffix, ".") {
		return fmt.Errorf("hostname_suffix must start with a dot (e.g., .example.com)")
	}

	if !hostnameSuffixPattern.MatchString(suffix) {
		return fmt.Errorf("hostname_suffix must be a valid domain suffix (e.g., .example.com)")
	}

	return nil
}

// validateValidityPeriod validates the certificate validity period
func validateValidityPeriod(days int) error {
	if days < 1 {
		return fmt.Errorf("validity_period_days must be at least 1 day")
	}

	if days > 3650 {
		return fmt.Errorf("validity_period_days must not exceed 3650 days (10 years)")
	}

	return nil
}

// validateCountryCode validates ISO 3166-1 alpha-2 country code
func validateCountryCode(code string) error {
	if strings.TrimSpace(code) == "" {
		return fmt.Errorf("country code is required")
	}

	if !countryCodePattern.MatchString(code) {
		return fmt.Errorf("country code must be exactly 2 uppercase letters (ISO 3166-1 alpha-2)")
	}

	return nil
}

// validateKeySize validates the RSA key size
func validateKeySize(size int) error {
	validSizes := []int{2048, 3072, 4096}

	for _, validSize := range validSizes {
		if size == validSize {
			return nil
		}
	}

	return fmt.Errorf("key size must be one of: 2048, 3072, or 4096 bits")
}
