import { useState } from "react";
import { api } from "@/lib/api";
import { SetupDefaults, SetupRequest, BackupPeekInfo } from "@/types";
import { useAppStore } from "@/stores/useAppStore";

interface UseSetupReturn {
    defaults: SetupDefaults | null;
    isLoading: boolean;
    error: string | null;

    // Operations
    loadConfig: () => Promise<void>;
    loadDefaults: () => Promise<void>;
    saveSetup: (req: SetupRequest) => Promise<void>;
    peekBackupInfo: (path: string) => Promise<BackupPeekInfo | null>;
    restoreFromBackupFile: (path: string) => Promise<void>;
    selectBackupFile: () => Promise<string | null>;

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

    const peekBackupInfo = async (
        path: string,
    ): Promise<BackupPeekInfo | null> => {
        setIsLoading(true);
        setError(null);
        try {
            return await api.peekBackupInfo(path);
        } catch (err) {
            handleError(err);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const restoreFromBackupFile = async (path: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await api.restoreFromBackupFile(path);
            await loadConfig();
            setIsSetupComplete(true);
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const selectBackupFile = async (): Promise<string | null> => {
        setError(null);
        try {
            const path = await api.selectBackupFile();
            return path || null;
        } catch (err) {
            handleError(err);
            return null;
        }
    };

    return {
        defaults,
        isLoading,
        error,
        loadConfig,
        loadDefaults,
        saveSetup,
        peekBackupInfo,
        restoreFromBackupFile,
        selectBackupFile,
        clearError: () => setError(null),
    };
}
