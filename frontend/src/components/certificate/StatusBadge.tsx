import { Badge } from "@/components/ui/badge";
import { getStatusColor, getStatusIcon } from "@/lib/theme";

interface StatusBadgeProps {
    status: "pending" | "active" | "expiring" | "expired";
    daysUntilExpiration?: number;
}

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

    return (
        <Badge className={getStatusColor(status)}>
            {getStatusIcon(status)} {getLabel()}
        </Badge>
    );
}
