import { Navigate } from "react-router-dom";
import { useAppStore } from "@/stores/useAppStore";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireUnlocked?: boolean; // If true, route requires encryption key
}

export function ProtectedRoute({
    children,
    requireUnlocked = false,
}: ProtectedRouteProps) {
    const { isSetupComplete, isLoading, isUnlocked } =
        useAppStore();

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

    // Route requires encryption key but user skipped
    if (requireUnlocked && !isUnlocked) {
        return <Navigate to="/" replace state={{ keyRequired: true }} />;
    }

    // All checks passed
    return <>{children}</>;
}
