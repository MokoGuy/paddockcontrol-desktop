// Re-export types from Wails-generated bindings
// Source of truth: Go structs in internal/models/ -> Wails generates wailsjs/go/models.ts
import { models } from "../../wailsjs/go/models";

// Re-export Wails-generated types as type aliases
export type Certificate = models.Certificate;
export type CertificateListItem = models.CertificateListItem;
export type CSRRequest = models.CSRRequest;
export type CSRResponse = models.CSRResponse;
export type SANEntry = models.SANEntry;
export type ImportRequest = models.ImportRequest;
export type CertificateFilter = models.CertificateFilter;
export type Config = models.Config;
export type SetupRequest = models.SetupRequest;
export type UpdateConfigRequest = models.UpdateConfigRequest;
export type SetupDefaults = models.SetupDefaults;
export type BackupData = models.BackupData;
export type BackupCertificate = models.BackupCertificate;
export type BackupValidationResult = models.BackupValidationResult;
export type KeyValidationResult = models.KeyValidationResult;
export type ChainCertificateInfo = models.ChainCertificateInfo;
export type HistoryEntry = models.HistoryEntry;
export type LocalBackupInfo = models.LocalBackupInfo;
export type UpdateInfo = models.UpdateInfo;
export type UpdateHistoryEntry = models.UpdateHistoryEntry;

// Stricter type definitions for status/enum fields
// (Wails generates 'string', these provide better type safety)
export type CertificateStatus = "pending" | "active" | "expiring" | "expired";
export type CertificateSortBy = "created" | "expiring" | "hostname";
export type SortOrder = "asc" | "desc";
export type ChainCertType = "leaf" | "intermediate" | "root";
export type BackupType = "auto" | "manual";

// Certificate upload preview (matches Go models.CertificateUploadPreview)
export interface CertificateUploadPreview {
    hostname: string;
    issuer_cn: string;
    issuer_o: string;
    not_before: number;
    not_after: number;
    sans?: string[];
    key_size: number;
    csr_match: boolean;
    key_match: boolean;
}

// Frontend-only types (not in Go backend)
export interface ImportResult {
    success: number;
    skipped: number;
    failed: number;
    conflicts?: string[];
}

export interface Toast {
    id: string;
    title: string;
    description?: string;
    type: "default" | "success" | "error" | "info";
    duration?: number;
}

export interface OperationResult<T = void> {
    success: boolean;
    data?: T;
    error?: string;
}
