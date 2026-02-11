import { useState } from "react";
import { api } from "@/lib/api";
import {
    SetupDefaults,
    SetupRequest,
    BackupData,
    BackupValidationResult,
} from "@/types";
import { useAppStore } from "@/stores/useAppStore";

interface UseSetupReturn {
    defaults: SetupDefaults | null;
    isLoading: boolean;
    error: string | null;

    // Operations
    loadConfig: () => Promise<void>;
    loadDefaults: () => Promise<void>;
    saveSetup: (req: SetupRequest) => Promise<void>;
    validateBackupFile: (
        path: string,
    ) => Promise<BackupValidationResult | null>;
    validateBackupKey: (backup: BackupData, key: string) => Promise<void>;
    restoreFromBackup: (backup: BackupData) => Promise<void>;

    // Utilities
    clearError: () => void;
}

export function useSetup(): UseSetupReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [defaults, setDefaults] = useState<SetupDefaults | null>(null);
    const { setIsSetupComplete } = useAppStore();

    const handleError = (err: unknown) => {
        const message =
            err instanceof Error ? err.message : "An error occurred";
        setError(message);
        console.error("Setup operation error:", err);
    };

    const loadConfig = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Config is loaded from defaults on setup
            const isComplete = await api.isSetupComplete();
            setIsSetupComplete(isComplete);
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadDefaults = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const defs = await api.getSetupDefaults();
            if (defs) {
                setDefaults(defs);
            }
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const saveSetup = async (req: SetupRequest) => {
        setIsLoading(true);
        setError(null);
        try {
            await api.saveSetup(req);
            await loadConfig();
            setIsSetupComplete(true);
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const validateBackupFile = async (
        path: string,
    ): Promise<BackupValidationResult | null> => {
        setIsLoading(true);
        setError(null);
        try {
            return await api.validateBackupFile(path);
        } catch (err) {
            handleError(err);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const validateBackupKey = async (backup: BackupData, key: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await api.validateEncryptionKeyForBackup(backup, key);
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const restoreFromBackup = async (backup: BackupData) => {
        setIsLoading(true);
        setError(null);
        try {
            console.log("🔄 [useSetup] Starting backup restore...");
            console.log(
                "📦 [useSetup] Backup has",
                backup.certificates?.length || 0,
                "certificates",
            );

            console.log("📡 [useSetup] Calling api.restoreFromBackup...");
            await api.restoreFromBackup(backup);
            console.log("✅ [useSetup] restoreFromBackup API call completed");

            console.log("🔍 [useSetup] Loading config after restore...");
            await loadConfig();
            console.log("✅ [useSetup] Config loaded");

            console.log("✅ [useSetup] Setting setup complete to true");
            setIsSetupComplete(true);

            console.log("✅ [useSetup] Restore completed successfully");
        } catch (err) {
            console.error("❌ [useSetup] Restore failed:", err);
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        defaults,
        isLoading,
        error,
        loadConfig,
        loadDefaults,
        saveSetup,
        validateBackupFile,
        validateBackupKey,
        restoreFromBackup,
        clearError: () => setError(null),
    };
}
