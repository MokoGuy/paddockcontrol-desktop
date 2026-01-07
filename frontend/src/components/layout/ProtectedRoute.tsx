import { Navigate } from "react-router-dom";
import { useAppStore } from "@/stores/useAppStore";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireEncryptionKey?: boolean; // If true, route requires encryption key
}

export function ProtectedRoute({
    children,
    requireEncryptionKey = false,
}: ProtectedRouteProps) {
    const {
        isWaitingForEncryptionKey,
        isSetupComplete,
        isLoading,
        isEncryptionKeyProvided,
    } = useAppStore();

    // Still loading initial state
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner text="Loading..." />
            </div>
        );
    }

    // Setup not complete - redirect to setup
    if (!isSetupComplete) {
        return <Navigate to="/setup" replace />;
    }

    // Still waiting for user decision on key (neither provided nor skipped)
    if (isWaitingForEncryptionKey) {
        return <Navigate to="/key" replace />;
    }

    // Route requires encryption key but user skipped
    if (requireEncryptionKey && !isEncryptionKeyProvided) {
        return <Navigate to="/dashboard" replace state={{ keyRequired: true }} />;
    }

    // All checks passed
    return <>{children}</>;
}
