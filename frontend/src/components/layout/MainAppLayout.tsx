import { Outlet } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { AppHeader } from "../shared/AppHeader";

/**
 * MainAppLayout - Router-level layout wrapper for main application pages
 *
 * This component uses React Router's Outlet pattern to wrap all main app routes
 * with a consistent header and layout structure. Individual pages no longer need
 * to import AppLayout or AppHeader directly.
 *
 * Usage in App.tsx:
 * <Route element={<MainAppLayout />}>
 *   <Route path="/" element={<Dashboard />} />
 *   <Route path="/settings" element={<Settings />} />
 * </Route>
 */
export function MainAppLayout() {
    // Main app pages don't need back button in header
    // Only setup/restore pages will have back button (handled by SetupAppLayout)

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-slate-950">
            {/* Header with main app configuration */}
            <AnimatePresence mode="wait">
                <AppHeader
                    variant="default"
                    showTitle
                    showAdminBadge
                    showEncryptionKey
                    showThemeToggle
                    showCloseButton
                />
            </AnimatePresence>

            {/* Main content area with scroll */}
            <main className="flex-1 overflow-y-auto scrollbar-float">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Child routes render here */}
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
