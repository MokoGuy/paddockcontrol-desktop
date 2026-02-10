import { Card, CardContent } from "@/components/ui/card";
import { AdminGatedButton } from "@/components/shared/AdminGatedButton";

interface DangerZoneCardProps {
    title: string;
    description: string;
    buttonLabel: string;
    onClick: () => void;
    isAdminModeEnabled: boolean;
    requireEncryptionKey?: boolean;
    disabled?: boolean;
    disabledReason?: string;
    className?: string;
}

export function DangerZoneCard({
    title,
    description,
    buttonLabel,
    onClick,
    isAdminModeEnabled,
    requireEncryptionKey,
    disabled,
    disabledReason,
    className,
}: DangerZoneCardProps) {
    return (
        <Card
            className={`border-admin/30 bg-admin-muted ${!isAdminModeEnabled ? "opacity-60" : ""} ${className ?? ""}`}
        >
            <CardContent className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-destructive">
                        {title}
                    </p>
                    <p className="text-xs text-admin/80 mt-1">{description}</p>
                </div>
                <AdminGatedButton
                    variant="outline"
                    size="sm"
                    className="border-admin/50 text-admin hover:bg-admin/20"
                    requireEncryptionKey={requireEncryptionKey}
                    disabled={disabled}
                    disabledReason={disabledReason}
                    onClick={onClick}
                >
                    {buttonLabel}
                </AdminGatedButton>
            </CardContent>
        </Card>
    );
}
