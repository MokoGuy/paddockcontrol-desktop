import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/useAppStore";

interface AdminGatedButtonProps
    extends React.ComponentProps<typeof Button> {
    requireAdminMode?: boolean;
    requireUnlocked?: boolean;
    disabledReason?: string;
}

export function AdminGatedButton({
    requireAdminMode = true,
    requireUnlocked = false,
    disabledReason,
    disabled,
    children,
    ...props
}: AdminGatedButtonProps) {
    const { isAdminModeEnabled, isUnlocked } = useAppStore();

    const isGatedByAdmin = requireAdminMode && !isAdminModeEnabled;
    const isGatedByKey = requireUnlocked && !isUnlocked;
    const isDisabled = isGatedByAdmin || isGatedByKey || !!disabled;

    const tooltipMessage = isGatedByAdmin
        ? "Admin mode required"
        : isGatedByKey
          ? "Encryption key required"
          : disabledReason || null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex">
                    <Button disabled={isDisabled} {...props}>
                        {children}
                    </Button>
                </span>
            </TooltipTrigger>
            {tooltipMessage && (
                <TooltipContent>{tooltipMessage}</TooltipContent>
            )}
        </Tooltip>
    );
}
