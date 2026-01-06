import { create } from "zustand";

interface AppState {
    // Encryption key state
    isWaitingForEncryptionKey: boolean;
    setIsWaitingForEncryptionKey: (waiting: boolean) => void;

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

    isSetupComplete: false,
    setIsSetupComplete: (complete) => set({ isSetupComplete: complete }),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

    error: null,
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
}));
