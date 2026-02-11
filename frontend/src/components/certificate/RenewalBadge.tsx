import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";

export function RenewalBadge() {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
            <Badge className="inline-flex items-center gap-1 bg-renewal text-renewal-foreground hover:bg-renewal/90">
                <HugeiconsIcon icon={RefreshIcon} className="w-3.5 h-3.5" strokeWidth={2} />
                Renewal
            </Badge>
        </motion.div>
    );
}
