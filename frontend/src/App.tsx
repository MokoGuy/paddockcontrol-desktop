import { useEffect } from "react";
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";
import { Toaster } from "sonner";
import { useAppStore } from "@/stores/useAppStore";
import { api } from "@/lib/api";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { MainAppLayout } from "@/components/layout/MainAppLayout";
import { SetupAppLayout } from "@/components/layout/SetupAppLayout";
import { FloatingSetupLayout } from "@/components/layout/FloatingSetupLayout";

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

                // Check if encryption key is provided
                if (setupComplete) {
                    const keyProvided = await api.isEncryptionKeyProvided();
                    setIsEncryptionKeyProvided(keyProvided);
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
    }, [setIsEncryptionKeyProvided, setIsSetupComplete, setIsLoading]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
                <LoadingSpinner text="Loading..." />
            </div>
        );
    }

    return (
        <Routes>
            {/* Setup Routes - Using router-level layouts */}
            {!isSetupComplete ? (
                <>
                    {/* Setup choice page with floating header */}
                    <Route element={<FloatingSetupLayout />}>
                        <Route path="/setup" element={<SetupChoice />} />
                    </Route>

                    {/* Setup wizard and restore with standard header + back button */}
                    <Route element={<SetupAppLayout />}>
                        <Route path="/setup/wizard" element={<SetupWizard />} />
                        <Route
                            path="/setup/restore"
                            element={<RestoreBackup />}
                        />
                    </Route>
                </>
            ) : (
                <>
                    <Route
                        path="/setup"
                        element={<Navigate to="/" replace />}
                    />
                    <Route
                        path="/setup/wizard"
                        element={<Navigate to="/" replace />}
                    />
                    <Route
                        path="/setup/restore"
                        element={<Navigate to="/" replace />}
                    />
                </>
            )}

            {/* Backwards compatibility redirect */}
            <Route path="/dashboard" element={<Navigate to="/" replace />} />

            {/* Main app routes - Using router-level layout */}
            {!isSetupComplete ? (
                <Route path="/" element={<Navigate to="/setup" replace />} />
            ) : (
                <Route element={<MainAppLayout />}>
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <Dashboard />
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
                </Route>
            )}
        </Routes>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <Router>
                <AppContent />
            </Router>
            <Toaster richColors position="top-right" offset="80px" />
        </ErrorBoundary>
    );
}
