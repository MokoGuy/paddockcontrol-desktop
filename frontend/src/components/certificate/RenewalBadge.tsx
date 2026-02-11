import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";

export function RenewalBadge() {
    return (
        <Badge className="inline-flex items-center gap-1 bg-renewal text-renewal-foreground hover:bg-renewal/90">
            <HugeiconsIcon icon={RefreshIcon} className="w-3.5 h-3.5" strokeWidth={2} />
            Renewal
        </Badge>
    );
}
