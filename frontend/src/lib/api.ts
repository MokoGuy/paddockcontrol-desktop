// Wails bindings wrapper - provides typed access to backend methods
// Auto-generated Wails bindings are in ../wailsjs/go/main/App

import * as App from "../../wailsjs/go/main/App";
import {
    Certificate,
    CertificateListItem,
    CSRRequest,
    CSRResponse,
    ImportRequest,
    CertificateFilter,
    SetupRequest,
    SetupDefaults,
    BackupData,
    BackupValidationResult,
    KeyValidationResult,
    ChainCertificateInfo,
} from "../types";

// Encryption Key Management
export const api = {
    // Key management
    isWaitingForEncryptionKey: () => App.IsWaitingForEncryptionKey(),
    isEncryptionKeyProvided: () => App.IsEncryptionKeyProvided(),
    provideEncryptionKey: (key: string) =>
        App.ProvideEncryptionKey(key) as Promise<KeyValidationResult>,
    skipEncryptionKey: () => App.SkipEncryptionKey(),

    // Setup
    isSetupComplete: () => App.IsSetupComplete(),
    saveSetup: (req: SetupRequest) => App.SaveSetup(req),
    getSetupDefaults: () => App.GetSetupDefaults() as Promise<SetupDefaults>,

    // Backup validation and restore
    validateBackupFile: (path: string) =>
        App.ValidateBackupFile(path) as Promise<BackupValidationResult>,
    validateEncryptionKeyForBackup: (backup: BackupData, key: string) =>
        App.ValidateEncryptionKeyForBackup(backup as any, key),
    restoreFromBackup: (backup: BackupData) => {
        console.log("📡 [api.restoreFromBackup] Calling Wails backend...");
        console.log("📦 [api.restoreFromBackup] Backup data:", {
            version: backup.version,
            certificateCount: backup.certificates?.length || 0,
            hasConfig: !!backup.config,
            hasEncryptionKey: !!backup.encryption_key,
        });
        return App.RestoreFromBackup(backup as any)
            .then(() => {
                console.log("✅ [api.restoreFromBackup] Wails call succeeded");
            })
            .catch((err) => {
                console.error(
                    "❌ [api.restoreFromBackup] Wails call failed:",
                    err,
                );
                throw err;
            });
    },

    // Certificate operations
    generateCSR: (req: CSRRequest) =>
        App.GenerateCSR(req as any) as Promise<CSRResponse>,
    uploadCertificate: (hostname: string, certPEM: string) =>
        App.UploadCertificate(hostname, certPEM),
    importCertificate: (req: ImportRequest) =>
        App.ImportCertificate(req as any),
    listCertificates: (filter: CertificateFilter) =>
        App.ListCertificates(filter as any) as Promise<CertificateListItem[]>,
    getCertificate: (hostname: string) =>
        App.GetCertificate(hostname) as Promise<Certificate>,
    getCertificateChain: (hostname: string) =>
        App.GetCertificateChain(hostname) as Promise<ChainCertificateInfo[]>,
    deleteCertificate: (hostname: string) => App.DeleteCertificate(hostname),

    // File operations
    saveCSRToFile: (hostname: string) => App.SaveCSRToFile(hostname),
    saveCertificateToFile: (hostname: string) =>
        App.SaveCertificateToFile(hostname),
    saveChainToFile: (hostname: string) => App.SaveChainToFile(hostname),
    savePrivateKeyToFile: (hostname: string) =>
        App.SavePrivateKeyToFile(hostname),

    // Backup export
    exportBackup: () => App.ExportBackup(false),

    // Utilities
    copyToClipboard: (text: string) => App.CopyToClipboard(text),
    getDataDirectory: () => App.GetDataDirectory() as Promise<string>,
    getBuildInfo: () => App.GetBuildInfo() as Promise<Record<string, string>>,

    // Database management
    resetDatabase: () => App.ResetDatabase(),
};

export type Api = typeof api;
