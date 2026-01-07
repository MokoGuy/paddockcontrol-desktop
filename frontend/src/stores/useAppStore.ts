import { create } from "zustand";

interface KeyValidationError {
    message: string;
    failedHostnames: string[];
}

interface AppState {
    // Encryption key state
    isWaitingForEncryptionKey: boolean;
    setIsWaitingForEncryptionKey: (waiting: boolean) => void;

    // Track if key was actually provided (not skipped)
    isEncryptionKeyProvided: boolean;
    setIsEncryptionKeyProvided: (provided: boolean) => void;

    // Key validation error (for showing which certs failed)
    keyValidationError: KeyValidationError | null;
    setKeyValidationError: (error: KeyValidationError | null) => void;

    // Setup state
    isSetupComplete: boolean;
    setIsSetupComplete: (complete: boolean) => void;

    // Loading states
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;

    // Error state
    error: string | null;
    setError: (error: string | null) => void;
    clearError: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    isWaitingForEncryptionKey: true,
    setIsWaitingForEncryptionKey: (waiting) =>
        set({ isWaitingForEncryptionKey: waiting }),

    isEncryptionKeyProvided: false,
    setIsEncryptionKeyProvided: (provided) =>
        set({ isEncryptionKeyProvided: provided }),

    keyValidationError: null,
    setKeyValidationError: (error) => set({ keyValidationError: error }),

    isSetupComplete: false,
    setIsSetupComplete: (complete) => set({ isSetupComplete: complete }),

    isLoading: true,
    setIsLoading: (loading) => set({ isLoading: loading }),

    error: null,
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
}));
