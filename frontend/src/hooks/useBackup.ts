import { useState } from "react";
import { api } from "@/lib/api";

interface UseBackupReturn {
    isLoading: boolean;
    error: string | null;

    // Operations
    exportBackup: () => Promise<void>;
    copyToClipboard: (text: string) => Promise<void>;
    getDataDirectory: () => Promise<string | null>;

    // Utilities
    clearError: () => void;
}

export function useBackup(): UseBackupReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    return {
        isLoading,
        error,
        exportBackup,
        copyToClipboard,
        getDataDirectory,
        clearError: () => setError(null),
    };
}
