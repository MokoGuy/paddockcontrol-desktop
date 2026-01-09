import { Outlet } from "react-router-dom";
import { AppHeader } from "../shared/AppHeader";

/**
 * FloatingSetupLayout - Router-level layout wrapper for setup choice page
 *
 * This component uses React Router's Outlet pattern with a floating header
 * variant (controls in top-right corner). Used for the initial setup choice
 * page which has a centered layout.
 *
 * Usage in App.tsx:
 * <Route element={<FloatingSetupLayout />}>
 *   <Route path="/setup" element={<SetupChoice />} />
 * </Route>
 */
export function FloatingSetupLayout() {
    return (
        <div
            className="relative flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-slate-950"
            style={{ "--wails-draggable": "drag" } as React.CSSProperties}
        >
            {/* Floating header - just theme toggle and close button in top-right */}
            <AppHeader
                variant="floating"
                showThemeToggle
                showCloseButton
            />

            {/* Content fills entire screen - child handles own layout */}
            <main className="flex-1 min-h-0 overflow-y-auto scrollbar-float flex items-center justify-center">
                <Outlet />
            </main>
        </div>
    );
}
