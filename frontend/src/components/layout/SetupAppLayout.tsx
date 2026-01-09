import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { AppHeader } from "../shared/AppHeader";
import { AnimatedOutlet } from "../shared/AnimatedOutlet";

/**
 * SetupAppLayout - Router-level layout wrapper for setup/restore pages
 *
 * This component uses React Router's Outlet pattern to wrap all setup routes
 * with a consistent header and layout structure. Setup pages have a back button
 * in the header that navigates to the setup choice page.
 *
 * Usage in App.tsx:
 * <Route element={<SetupAppLayout />}>
 *   <Route path="/setup/wizard" element={<SetupWizard />} />
 *   <Route path="/setup/restore" element={<RestoreBackup />} />
 * </Route>
 */
export function SetupAppLayout() {
    const navigate = useNavigate();

    const handleBack = () => {
        navigate("/setup", { replace: true });
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Header with back button for setup pages */}
            <AnimatePresence mode="wait">
                <AppHeader
                    variant="default"
                    showBackButton
                    onBack={handleBack}
                    showTitle
                    showThemeToggle
                    showCloseButton
                />
            </AnimatePresence>

            {/* Main content area with scroll */}
            <main className="flex-1 overflow-y-auto scrollbar-float">
                {/* Child routes render here with animation */}
                <AnimatedOutlet className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" />
            </main>
        </div>
    );
}
