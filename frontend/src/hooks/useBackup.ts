import { useState } from "react";
import { api } from "@/lib/api";
import { LocalBackupInfo } from "@/types";

interface UseBackupReturn {
    isLoading: boolean;
    error: string | null;

    // Export operations
    exportBackup: () => Promise<void>;
    copyToClipboard: (text: string) => Promise<void>;
    getDataDirectory: () => Promise<string | null>;

    // Local backup operations
    localBackups: LocalBackupInfo[];
    isLoadingBackups: boolean;
    listLocalBackups: () => Promise<void>;
    createManualBackup: () => Promise<void>;
    restoreLocalBackup: (filename: string) => Promise<void>;
    deleteLocalBackup: (filename: string) => Promise<void>;

    // Utilities
    clearError: () => void;
}

export function useBackup(): UseBackupReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [localBackups, setLocalBackups] = useState<LocalBackupInfo[]>([]);
    const [isLoadingBackups, setIsLoadingBackups] = useState(false);

    const handleError = (err: unknown) => {
        const message =
            err instanceof Error ? err.message : "An error occurred";
        setError(message);
        console.error("Backup operation error:", err);
    };

    const exportBackup = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await api.exportBackup();
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        setError(null);
        try {
            await api.copyToClipboard(text);
        } catch (err) {
            handleError(err);
        }
    };

    const getDataDirectory = async (): Promise<string | null> => {
        setError(null);
        try {
            return await api.getDataDirectory();
        } catch (err) {
            handleError(err);
            return null;
        }
    };

    const listLocalBackups = async () => {
        setIsLoadingBackups(true);
        setError(null);
        try {
            const backups = await api.listLocalBackups();
            setLocalBackups(backups || []);
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoadingBackups(false);
        }
    };

    const createManualBackup = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await api.createManualBackup();
            await listLocalBackups();
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const restoreLocalBackup = async (filename: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await api.restoreLocalBackup(filename);
        } catch (err) {
            handleError(err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const deleteLocalBackup = async (filename: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await api.deleteLocalBackup(filename);
            await listLocalBackups();
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
        error,
        exportBackup,
        copyToClipboard,
        getDataDirectory,
        localBackups,
        isLoadingBackups,
        listLocalBackups,
        createManualBackup,
        restoreLocalBackup,
        deleteLocalBackup,
        clearError: () => setError(null),
    };
}
