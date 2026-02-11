import { AnimatePresence } from "motion/react";
import { AppHeader } from "../shared/AppHeader";
import { AnimatedOutlet } from "../shared/AnimatedOutlet";
import { StarsBackground } from "../animate-ui/backgrounds/stars-background";

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
        <StarsBackground
            className="stars-bg-container relative flex flex-col h-screen"
            style={{ "--wails-draggable": "drag" } as React.CSSProperties}
            speed={80}
            factor={0.03}
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
        </StarsBackground>
    );
}
