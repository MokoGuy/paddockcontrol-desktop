import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "@/lib/theme";
import { CertificateStatus } from "@/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Tick02Icon,
    Clock04Icon,
    Alert02Icon,
    Cancel01Icon,
    HelpCircleIcon,
} from "@hugeicons/core-free-icons";

interface StatusBadgeProps {
    status: CertificateStatus | string;
    daysUntilExpiration?: number;
}

const statusIcons = {
    active: Tick02Icon,
    pending: Clock04Icon,
    expiring: Alert02Icon,
    expired: Cancel01Icon,
} as const;

export function StatusBadge({ status, daysUntilExpiration }: StatusBadgeProps) {
    const getLabel = () => {
        switch (status) {
            case "pending":
                return "Pending";
            case "active":
                return "Active";
            case "expiring":
                return `Expiring${daysUntilExpiration !== undefined ? ` (${daysUntilExpiration}d)` : ""}`;
            case "expired":
                return "Expired";
            default:
                return "Unknown";
        }
    };

    const icon = statusIcons[status as CertificateStatus] || HelpCircleIcon;

    return (
        <Badge className={`${getStatusColor(status)} inline-flex items-center gap-1`}>
            <HugeiconsIcon icon={icon} className="w-3.5 h-3.5" strokeWidth={2} />
            {getLabel()}
        </Badge>
    );
}
