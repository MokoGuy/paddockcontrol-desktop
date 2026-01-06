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
        isSetupComplete,
        setIsSetupComplete,
        isLoading,
        setIsLoading,
    } = useAppStore();

    useEffect(() => {
        // Check initial state on app load
        const checkInitialState = async () => {
            try {
                // First check if setup is complete
                const setupComplete = await api.isSetupComplete();
                setIsSetupComplete(setupComplete);

                // Only check for encryption key if setup IS complete
                if (setupComplete) {
                    const waiting = await api.isWaitingForEncryptionKey();
                    setIsWaitingForEncryptionKey(waiting);
                }
            } catch (error) {
                console.error("Failed to check initial state:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkInitialState();
    }, [setIsWaitingForEncryptionKey, setIsSetupComplete, setIsLoading]);

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
                            to={isSetupComplete ? "/dashboard" : "/setup"}
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
                        <Navigate to="/dashboard" replace />
                    ) : (
                        <SetupChoice />
                    )
                }
            />
            <Route
                path="/setup/wizard"
                element={
                    isSetupComplete ? (
                        <Navigate to="/dashboard" replace />
                    ) : (
                        <SetupWizard />
                    )
                }
            />
            <Route
                path="/setup/restore"
                element={
                    isSetupComplete ? (
                        <Navigate to="/dashboard" replace />
                    ) : (
                        <RestoreBackup />
                    )
                }
            />

            {/* Main App Routes - Requires setup complete and encryption key */}
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />
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
                    <ProtectedRoute>
                        <GenerateCSR />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/certificates/import"
                element={
                    <ProtectedRoute>
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

            {/* Catch-all redirect based on app state */}
            <Route
                path="/"
                element={
                    !isSetupComplete ? (
                        <Navigate to="/setup" replace />
                    ) : isWaitingForEncryptionKey ? (
                        <Navigate to="/key" replace />
                    ) : (
                        <Navigate to="/dashboard" replace />
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
