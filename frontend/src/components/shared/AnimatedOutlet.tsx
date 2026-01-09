import { useOutlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { cloneElement } from "react";

interface AnimatedOutletProps {
    className?: string;
}

export function AnimatedOutlet({ className }: AnimatedOutletProps) {
    const location = useLocation();
    const outlet = useOutlet();

    return (
        <AnimatePresence mode="wait">
            {outlet && (
                <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{
                        duration: 0.25,
                        ease: [0.4, 0, 0.2, 1],
                    }}
                    className={className}
                >
                    {cloneElement(outlet, { key: location.pathname })}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
