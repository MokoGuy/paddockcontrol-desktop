import { Button } from "@/components/ui/button";
import { StatusAlert } from "@/components/shared/StatusAlert";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";

interface LimitedModeNoticeProps {
  onProvideKey: () => void;
  className?: string;
}

export function LimitedModeNotice({ onProvideKey, className }: LimitedModeNoticeProps) {
  return (
    <StatusAlert
      variant="warning"
      className={className}
      icon={
        <HugeiconsIcon
          icon={Alert02Icon}
          className="size-4"
          strokeWidth={2}
        />
      }
      title="Limited mode - encryption key not provided"
      action={
        <Button
          variant="outline"
          size="sm"
          className="border-warning/50 text-warning-foreground hover:bg-warning/20"
          onClick={onProvideKey}
        >
          Provide Key
        </Button>
      }
    >
      Some features are disabled. Provide your encryption key to unlock full functionality.
    </StatusAlert>
  );
}
