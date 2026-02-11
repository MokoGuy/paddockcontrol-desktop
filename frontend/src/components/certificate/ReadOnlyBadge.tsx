import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLock02Icon } from "@hugeicons/core-free-icons";

export function ReadOnlyBadge() {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
            <Badge variant="secondary" className="inline-flex items-center gap-1">
                <HugeiconsIcon icon={SquareLock02Icon} className="w-3.5 h-3.5" strokeWidth={2} />
                Read-only
            </Badge>
        </motion.div>
    );
}
