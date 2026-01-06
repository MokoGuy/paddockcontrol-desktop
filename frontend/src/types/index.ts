// Types auto-generated from Wails bindings or extended here
// These match the Go models in internal/models

export interface Certificate {
  hostname: string;
  pending_csr?: string;
  certificate_pem?: string;
  created_at: number;
  expires_at?: number;
  note?: string;
  pending_note?: string;
  read_only: boolean;

  // Computed fields
  status: 'pending' | 'active' | 'expiring' | 'expired';
  sans?: string[];
  organization?: string;
  organizational_unit?: string;
  city?: string;
  state?: string;
  country?: string;
  key_size?: number;
  days_until_expiration?: number;
}

export interface CertificateListItem {
  hostname: string;
  status: 'pending' | 'active' | 'expiring' | 'expired';
  sans?: string[];
  key_size?: number;
  created_at: number;
  expires_at?: number;
  days_until_expiration?: number;
  read_only: boolean;
}

export interface CSRRequest {
  hostname: string;
  sans?: string[];
  organization: string;
  organizational_unit?: string;
  city: string;
  state: string;
  country: string;
  key_size: number;
  note?: string;
  is_renewal?: boolean;
}

export interface CSRResponse {
  hostname: string;
  csr: string;
  message: string;
}

export interface ImportRequest {
  certificate_pem: string;
  private_key_pem: string;
  cert_chain_pem?: string;
  note?: string;
}

export interface CertificateFilter {
  status?: 'all' | 'pending' | 'active' | 'expiring' | 'expired';
  sort_by?: 'created' | 'expiring' | 'hostname';
  sort_order?: 'asc' | 'desc';
}

export interface Config {
  id: number;
  owner_email: string;
  ca_name: string;
  hostname_suffix: string;
  validity_period_days: number;
  default_organization: string;
  default_organizational_unit?: string;
  default_city: string;
  default_state: string;
  default_country: string;
  default_key_size: number;
  is_configured: number;
  created_at: number;
  last_modified: number;
}

export interface SetupRequest {
  owner_email: string;
  ca_name: string;
  hostname_suffix: string;
  validity_period_days: number;
  default_organization: string;
  default_organizational_unit?: string;
  default_city: string;
  default_state: string;
  default_country: string;
  default_key_size: number;
}

export interface SetupDefaults {
  validity_period_days: number;
  default_key_size: number;
  default_country: string;
}

export interface BackupData {
  version: string;
  exported_at: number;
  encryption_key?: string;
  config?: Config;
  certificates?: BackupCertificate[];
}

export interface BackupCertificate {
  hostname: string;
  encrypted_key?: string;
  pending_csr_pem?: string;
  certificate_pem?: string;
  pending_encrypted_private_key?: string;
  created_at: number;
  expires_at?: number;
  note?: string;
  pending_note?: string;
  read_only: boolean;
}

export interface BackupValidationResult {
  valid: boolean;
  version: string;
  certificate_count: number;
  has_encrypted_keys: boolean;
  has_encryption_key: boolean;
  encryption_key: string;
  exported_at: number;
}

export interface ImportResult {
  success: number;
  skipped: number;
  failed: number;
  conflicts?: string[];
}

export interface ChainCertificateInfo {
  subject_cn: string;
  subject_o: string;
  issuer_cn: string;
  issuer_o: string;
  not_before_timestamp: number;
  not_after_timestamp: number;
  serial_number: string;
  cert_type: 'leaf' | 'intermediate' | 'root';
  depth: number;
}

// Frontend-only types
export interface Toast {
  id: string;
  title: string;
  description?: string;
  type: 'default' | 'success' | 'error' | 'info';
  duration?: number;
}

export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
