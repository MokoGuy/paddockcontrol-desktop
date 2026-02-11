import { motion } from "motion/react";

interface ReadOnlyFadeProps {
    readOnly: boolean;
    children: React.ReactNode;
}

export function ReadOnlyFade({ readOnly, children }: ReadOnlyFadeProps) {
    return (
        <motion.div
            animate={{ opacity: readOnly ? 0.5 : 1 }}
            transition={{ duration: 0.2 }}
        >
            {children}
        </motion.div>
    );
}
