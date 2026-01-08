import { useEffect } from "react";
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";
import { useAppStore } from "@/stores/useAppStore";
import { api } from "@/lib/api";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

// Wait for Wails bindings to be available
const waitForWails = (timeout = 5000): Promise<void> => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const check = () => {
            // Check if Wails bindings are available
            if (
                typeof window !== "undefined" &&
                (window as any).go?.main?.App
            ) {
                resolve();
                return;
            }

            // Check timeout
            if (Date.now() - startTime > timeout) {
                reject(new Error("Wails bindings not available after timeout"));
                return;
            }

            // Retry after a short delay
            setTimeout(check, 50);
        };

        check();
    });
};

// Pages
import { EncryptionKeyPrompt } from "@/pages/EncryptionKeyPrompt";
import { SetupChoice } from "@/pages/SetupChoice";
import { SetupWizard } from "@/pages/SetupWizard";
import { RestoreBackup } from "@/pages/RestoreBackup";
import { Dashboard } from "@/pages/Dashboard";
import { CertificateDetail } from "@/pages/CertificateDetail";
import { GenerateCSR } from "@/pages/GenerateCSR";
import { ImportCertificate } from "@/pages/ImportCertificate";
import { Settings } from "@/pages/Settings";

function AppContent() {
    const {
        isWaitingForEncryptionKey,
        setIsWaitingForEncryptionKey,
        setIsEncryptionKeyProvided,
        isSetupComplete,
        setIsSetupComplete,
        isLoading,
        setIsLoading,
    } = useAppStore();

    useEffect(() => {
        // Check initial state on app load
        const checkInitialState = async () => {
            try {
                // Wait for Wails bindings to be available
                await waitForWails();

                // First check if setup is complete
                const setupComplete = await api.isSetupComplete();
                setIsSetupComplete(setupComplete);

                // Only check for encryption key state if setup IS complete
                if (setupComplete) {
                    const waiting = await api.isWaitingForEncryptionKey();
                    setIsWaitingForEncryptionKey(waiting);

                    // If not waiting, also check if key was actually provided
                    if (!waiting) {
                        const keyProvided = await api.isEncryptionKeyProvided();
                        setIsEncryptionKeyProvided(keyProvided);
                    }
                }
            } catch (error) {
                console.error("Failed to check initial state:", error);
                // If Wails bindings aren't available (e.g., deep URL navigation),
                // redirect to root to let Wails properly initialize
                if (
                    error instanceof Error &&
                    error.message.includes("Wails bindings not available")
                ) {
                    window.location.href = "/";
                    return;
                }
            } finally {
                setIsLoading(false);
            }
        };

        checkInitialState();
    }, [
        setIsWaitingForEncryptionKey,
        setIsEncryptionKeyProvided,
        setIsSetupComplete,
        setIsLoading,
    ]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
                <LoadingSpinner text="Loading..." />
            </div>
        );
    }

    return (
        <Routes>
            {/* Encryption Key Prompt - Only when setup complete and waiting for key */}
            <Route
                path="/key"
                element={
                    isSetupComplete && isWaitingForEncryptionKey ? (
                        <EncryptionKeyPrompt />
                    ) : (
                        <Navigate
                            to={isSetupComplete ? "/" : "/setup"}
                            replace
                        />
                    )
                }
            />

            {/* Setup Routes - For first-time setup or restore, no encryption key needed */}
            <Route
                path="/setup"
                element={
                    isSetupComplete ? (
                        <Navigate to="/" replace />
                    ) : (
                        <SetupChoice />
                    )
                }
            />
            <Route
                path="/setup/wizard"
                element={
                    isSetupComplete ? (
                        <Navigate to="/" replace />
                    ) : (
                        <SetupWizard />
                    )
                }
            />
            <Route
                path="/setup/restore"
                element={
                    isSetupComplete ? (
                        <Navigate to="/" replace />
                    ) : (
                        <RestoreBackup />
                    )
                }
            />

            {/* Backwards compatibility redirect */}
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route
                path="/certificates/:hostname"
                element={
                    <ProtectedRoute>
                        <CertificateDetail />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/certificates/generate"
                element={
                    <ProtectedRoute requireEncryptionKey>
                        <GenerateCSR />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/certificates/import"
                element={
                    <ProtectedRoute requireEncryptionKey>
                        <ImportCertificate />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/settings"
                element={
                    <ProtectedRoute>
                        <Settings />
                    </ProtectedRoute>
                }
            />

            {/* Dashboard at root */}
            <Route
                path="/"
                element={
                    !isSetupComplete ? (
                        <Navigate to="/setup" replace />
                    ) : (
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    )
                }
            />
        </Routes>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <Router>
                <AppContent />
            </Router>
        </ErrorBoundary>
    );
}
