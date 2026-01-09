import { ReactNode } from "react";
import { AppHeader } from "../shared/AppHeader";

interface AppLayoutProps {
    children: ReactNode;

    // Header configuration
    variant?: "default" | "floating";
    showBackButton?: boolean;
    onBack?: () => void;
    showTitle?: boolean;
    title?: string;
    showAdminBadge?: boolean;
    showEncryptionKey?: boolean;
    showThemeToggle?: boolean;
    showCloseButton?: boolean;

    // Layout configuration (optional overrides)
    containerClassName?: string;
    mainClassName?: string;
    contentClassName?: string;
}

export function AppLayout({
    children,
    variant = "default",
    showBackButton = false,
    onBack,
    showTitle = false,
    title,
    showAdminBadge = false,
    showEncryptionKey = false,
    showThemeToggle = true,
    showCloseButton = true,
    containerClassName = "flex flex-col h-screen bg-gray-50 dark:bg-slate-950",
    mainClassName = "flex-1 overflow-y-auto scrollbar-float",
    contentClassName = "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8",
}: AppLayoutProps) {
    // For floating variant (SetupChoice), children handle their own layout
    if (variant === "floating") {
        return (
            <div
                className="relative flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-slate-950"
                style={{ "--wails-draggable": "drag" } as React.CSSProperties}
            >
                <AppHeader
                    variant="floating"
                    showThemeToggle={showThemeToggle}
                    showCloseButton={showCloseButton}
                />
                {children}
            </div>
        );
    }

    // Default variant - standard layout with header bar
    return (
        <div className={containerClassName}>
            <AppHeader
                variant={variant}
                showBackButton={showBackButton}
                onBack={onBack}
                showTitle={showTitle}
                title={title}
                showAdminBadge={showAdminBadge}
                showEncryptionKey={showEncryptionKey}
                showThemeToggle={showThemeToggle}
                showCloseButton={showCloseButton}
            />

            <main className={mainClassName}>
                <div className={contentClassName}>
                    {children}
                </div>
            </main>
        </div>
    );
}
