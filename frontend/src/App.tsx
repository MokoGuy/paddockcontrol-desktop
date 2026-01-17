import { useEffect, useCallback } from "react";
import {
    HashRouter as Router,
    Routes,
    Route,
    Navigate,
    useLocation,
} from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { EventsOnce } from "../wailsjs/runtime/runtime";
import { useAppStore } from "@/stores/useAppStore";
import { useKonamiCode } from "@/hooks/useKonamiCode";
import { api } from "@/lib/api";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { MainAppLayout } from "@/components/layout/MainAppLayout";
import { SetupAppLayout } from "@/components/layout/SetupAppLayout";
import { FloatingSetupLayout } from "@/components/layout/FloatingSetupLayout";

// Wait for Wails bindings to be available using OnDomReady event
const waitForWails = (timeout = 2000): Promise<void> => {
    return new Promise((resolve, reject) => {
        // Check immediately - bindings may already be ready
        if (typeof window !== "undefined" && (window as any).go?.main?.App) {
            resolve();
            return;
        }

        // Set up timeout fallback
        const timer = setTimeout(() => {
            // Fallback: check if bindings became available during wait
            if ((window as any).go?.main?.App) {
                resolve();
            } else {
                reject(new Error("Wails bindings not available after timeout"));
            }
        }, timeout);

        // Wait for the ready event from Go backend (OnDomReady)
        EventsOnce("wails:ready", () => {
            clearTimeout(timer);
            resolve();
        });
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
        setIsAdminModeEnabled,
    } = useAppStore();
    const location = useLocation();

    // Enable admin mode via Konami code (app-wide, except during setup)
    const isSetupPage = location.pathname.startsWith("/setup");
    const handleKonamiSuccess = useCallback(() => {
        if (!isSetupPage) {
            console.debug("[App] Konami code entered - admin mode enabled");
            setIsAdminModeEnabled(true);
        }
    }, [isSetupPage, setIsAdminModeEnabled]);
    useKonamiCode(handleKonamiSuccess);

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
            } finally {
                setIsLoading(false);
            }
        };

        checkInitialState();
    }, [setIsEncryptionKeyProvided, setIsSetupComplete, setIsLoading]);

    // Determine layout group for exit animations
    const isSetupSubPage =
        location.pathname === "/setup/wizard" ||
        location.pathname === "/setup/restore";

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <LoadingSpinner text="Loading..." />
            </div>
        );
    }

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={isSetupSubPage ? "setup-sub" : "setup-main"}>
                {/* Setup Routes - Using router-level layouts */}
                {!isSetupComplete ? (
                    <>
                        {/* Setup choice page with floating header */}
                        <Route element={<FloatingSetupLayout />}>
                            <Route path="/setup" element={<SetupChoice />} />
                        </Route>

                        {/* Setup wizard and restore with standard header + back button */}
                        <Route
                            element={
                                <motion.div
                                    className="h-screen"
                                    initial={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <SetupAppLayout />
                                </motion.div>
                            }
                        >
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
        </AnimatePresence>
    );
}

export default function App() {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <ErrorBoundary>
                <Router>
                    <AppContent />
                </Router>
                <Toaster richColors position="top-right" offset="80px" />
            </ErrorBoundary>
        </ThemeProvider>
    );
}
