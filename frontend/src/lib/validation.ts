import { z } from 'zod';

// Encryption Key
export const encryptionKeySchema = z.object({
  key: z
    .string()
    .min(16, 'Encryption key must be at least 16 characters')
    .max(256, 'Encryption key is too long'),
});

export type EncryptionKeyInput = z.infer<typeof encryptionKeySchema>;

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
});

export type SetupRequestInput = z.infer<typeof setupRequestSchema>;

// CSR Request
export const csrRequestSchema = z.object({
  hostname: z
    .string()
    .min(1, 'Hostname is required')
    .max(255, 'Hostname is too long'),
  sans: z
    .array(z.string())
    .optional()
    .default([]),
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
  is_renewal: z
    .boolean()
    .default(false),
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

// Backup encryption key
export const backupKeySchema = z.object({
  key: z
    .string()
    .min(16, 'Encryption key must be at least 16 characters'),
});

export type BackupKeyInput = z.infer<typeof backupKeySchema>;
