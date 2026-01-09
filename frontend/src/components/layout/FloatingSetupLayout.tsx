import { AnimatePresence } from "motion/react";
import { AppHeader } from "../shared/AppHeader";
import { AnimatedOutlet } from "../shared/AnimatedOutlet";

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
            className="relative flex flex-col h-screen overflow-hidden bg-background"
            style={{ "--wails-draggable": "drag" } as React.CSSProperties}
        >
            {/* Floating header - just theme toggle and close button in top-right */}
            <AnimatePresence mode="wait">
                <AppHeader variant="floating" showThemeToggle showCloseButton />
            </AnimatePresence>

            {/* Content fills entire screen - child handles own layout */}
            <main className="flex-1 min-h-0 overflow-y-auto scrollbar-float flex items-center justify-center">
                {/* Child routes render here with animation */}
                <AnimatedOutlet className="w-full" />
            </main>
        </div>
    );
}
