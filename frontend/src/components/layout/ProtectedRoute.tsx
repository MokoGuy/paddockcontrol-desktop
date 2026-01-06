import { Navigate } from "react-router-dom";
import { useAppStore } from "@/stores/useAppStore";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isWaitingForEncryptionKey, isSetupComplete, isLoading } =
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

    // Setup complete but waiting for encryption key - redirect to key prompt
    if (isWaitingForEncryptionKey) {
        return <Navigate to="/key" replace />;
    }

    // All checks passed
    return <>{children}</>;
}
