import { z } from 'zod';

// Password
export const passwordSchema = z.object({
  key: z
    .string()
    .min(16, 'Password must be at least 16 characters')
    .max(256, 'Password is too long'),
});

export type PasswordInput = z.infer<typeof passwordSchema>;

// Change Password
export const changePasswordSchema = z.object({
  new_key: z
    .string()
    .min(16, 'New password must be at least 16 characters')
    .max(256, 'Password is too long'),
  new_key_confirm: z
    .string()
    .min(1, 'Please confirm your new password'),
}).refine((data) => data.new_key === data.new_key_confirm, {
  message: "Passwords do not match",
  path: ["new_key_confirm"],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Setup Request
export const setupRequestSchema = z.object({
  owner_email: z
    .string()
    .email('Invalid email address'),
  ca_name: z
    .string()
    .min(1, 'CA name is required')
    .max(255, 'CA name is too long'),
  hostname_suffix: z
    .string()
    .min(1, 'Hostname suffix is required')
    .max(255, 'Hostname suffix is too long'),
  validity_period_days: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Validity period must be at least 1 day')
    .max(3650, 'Validity period cannot exceed 10 years'),
  default_organization: z
    .string()
    .min(1, 'Organization is required')
    .max(255, 'Organization is too long'),
  default_organizational_unit: z
    .string()
    .max(255, 'Organizational unit is too long')
    .optional()
    .or(z.literal('')),
  default_city: z
    .string()
    .min(1, 'City is required')
    .max(255, 'City is too long'),
  default_state: z
    .string()
    .min(1, 'State is required')
    .max(255, 'State is too long'),
  default_country: z
    .string()
    .min(2, 'Country code must be 2 characters')
    .max(2, 'Country code must be 2 characters'),
  default_key_size: z
    .number()
    .int('Must be a whole number')
    .min(2048, 'Key size must be at least 2048 bits')
    .max(8192, 'Key size cannot exceed 8192 bits'),
  password: z
    .string()
    .min(16, 'Password must be at least 16 characters')
    .max(256, 'Password is too long'),
  password_confirm: z
    .string()
    .min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.password_confirm, {
  message: "Passwords do not match",
  path: ["password_confirm"],
});

export type SetupRequestInput = z.infer<typeof setupRequestSchema>;

// Field groups for per-step validation in setup wizard
export const setupStepFields = {
  email: ["owner_email"],
  "ca-config": ["ca_name", "hostname_suffix"],
  organization: [
    "default_organization",
    "default_organizational_unit",
    "default_city",
    "default_state",
    "default_country",
  ],
  "cert-defaults": ["validity_period_days", "default_key_size"],
  "password": ["password", "password_confirm"],
  review: [],
} as const;

// SAN Type enum
export const sanTypeSchema = z.enum(['dns', 'ip']);
export type SANType = z.infer<typeof sanTypeSchema>;

// SAN Entry
export const sanEntrySchema = z.object({
  value: z.string().min(1, 'SAN value is required'),
  type: sanTypeSchema,
});
export type SANEntry = z.infer<typeof sanEntrySchema>;

// Validation regex patterns
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const ipv6Regex = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^::(?:[a-fA-F0-9]{1,4}:){0,6}[a-fA-F0-9]{1,4}$|^[a-fA-F0-9]{1,4}::(?:[a-fA-F0-9]{1,4}:){0,5}[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,6}::[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,7}:$/;
const dnsLabelRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

/**
 * Validate a DNS hostname
 * - Must have at least 2 levels (e.g., domain.tld)
 * - Wildcards (*.domain.tld) are allowed
 */
export function validateDNS(value: string): string | null {
  if (!value) return 'DNS name is required';

  // Check for wildcard
  const isWildcard = value.startsWith('*.');
  const dnsName = isWildcard ? value.slice(2) : value;

  const labels = dnsName.split('.');

  // Must have at least 2 levels
  if (labels.length < 2) {
    return 'Hostname must have at least 2 levels (e.g., domain.tld)';
  }

  // Validate each label
  for (const label of labels) {
    if (!label || label.length > 63) {
      return 'Invalid hostname format';
    }
    if (!dnsLabelRegex.test(label)) {
      return 'Invalid hostname format';
    }
  }

  return null;
}

/**
 * Validate an IP address (IPv4 or IPv6)
 */
export function validateIP(value: string): string | null {
  if (!value) return 'IP address is required';
  if (!ipv4Regex.test(value) && !ipv6Regex.test(value)) {
    return 'Invalid IP address format (IPv4 or IPv6)';
  }
  return null;
}

/**
 * Validate a SAN value based on its type
 */
export function validateSANValue(value: string, type: SANType): string | null {
  switch (type) {
    case 'dns':
      return validateDNS(value);
    case 'ip':
      return validateIP(value);
    default:
      return 'Unknown SAN type';
  }
}

/**
 * Check if a hostname ends with the given suffix
 */
export function hasSuffix(value: string, suffix: string): boolean {
  if (!suffix) return false;
  return value.endsWith(suffix);
}

/**
 * Detect SAN type from value
 */
export function detectSANType(value: string): SANType {
  if (ipv4Regex.test(value) || ipv6Regex.test(value)) return 'ip';
  return 'dns';
}

// CSR Form Input - fields managed by the form
// Note: sans, is_renewal, skip_suffix_validation are managed separately
// and added to the request in onSubmit
export const csrRequestSchema = z.object({
  hostname: z
    .string()
    .min(1, 'Hostname is required')
    .max(255, 'Hostname is too long'),
  organization: z
    .string()
    .min(1, 'Organization is required')
    .max(255, 'Organization is too long'),
  organizational_unit: z
    .string()
    .max(255, 'Organizational unit is too long')
    .optional()
    .or(z.literal('')),
  city: z
    .string()
    .min(1, 'City is required')
    .max(255, 'City is too long'),
  state: z
    .string()
    .min(1, 'State is required')
    .max(255, 'State is too long'),
  country: z
    .string()
    .min(2, 'Country code must be 2 characters')
    .max(2, 'Country code must be 2 characters'),
  key_size: z
    .number()
    .int('Must be a whole number')
    .min(2048, 'Key size must be at least 2048 bits')
    .max(8192, 'Key size cannot exceed 8192 bits'),
  note: z
    .string()
    .max(500, 'Note is too long')
    .optional()
    .or(z.literal('')),
});

export type CSRRequestInput = z.infer<typeof csrRequestSchema>;

// Import Certificate
export const importCertificateSchema = z.object({
  certificate_pem: z
    .string()
    .min(50, 'Certificate is required (PEM format)')
    .refine((val) => val.includes('BEGIN CERTIFICATE'), 'Invalid certificate format'),
  private_key_pem: z
    .string()
    .min(50, 'Private key is required (PEM format)')
    .refine((val) => val.includes('BEGIN') && val.includes('PRIVATE'), 'Invalid private key format'),
  note: z
    .string()
    .max(500, 'Note is too long')
    .optional()
    .or(z.literal('')),
});

export type ImportCertificateInput = z.infer<typeof importCertificateSchema>;

// Upload Certificate
export const uploadCertificateSchema = z.object({
  hostname: z
    .string()
    .min(1, 'Hostname is required')
    .max(255, 'Hostname is too long'),
  certificate_pem: z
    .string()
    .min(50, 'Certificate is required (PEM format)')
    .refine((val) => val.includes('BEGIN CERTIFICATE'), 'Invalid certificate format'),
});

export type UploadCertificateInput = z.infer<typeof uploadCertificateSchema>;

// Certificate Filter
export const certificateFilterSchema = z.object({
  status: z
    .enum(['all', 'pending', 'active', 'expiring', 'expired'])
    .default('all'),
  sort_by: z
    .enum(['created', 'expiring', 'hostname'])
    .default('created'),
  sort_order: z
    .enum(['asc', 'desc'])
    .default('desc'),
});

export type CertificateFilterInput = z.infer<typeof certificateFilterSchema>;

