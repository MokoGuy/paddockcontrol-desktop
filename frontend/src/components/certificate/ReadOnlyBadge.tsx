import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLock02Icon } from "@hugeicons/core-free-icons";

export function ReadOnlyBadge() {
    return (
        <Badge variant="secondary" className="inline-flex items-center gap-1">
            <HugeiconsIcon icon={SquareLock02Icon} className="w-3.5 h-3.5" strokeWidth={2} />
            Read-only
        </Badge>
    );
}
