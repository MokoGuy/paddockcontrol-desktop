import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
    Alert,
    AlertTitle,
    AlertDescription,
    AlertAction,
} from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const statusAlertVariants = cva("rounded-none", {
    variants: {
        variant: {
            destructive:
                "bg-destructive/10 border-destructive/30 text-destructive *:data-[slot=alert-description]:text-destructive/80",
            warning:
                "bg-warning-muted border-warning/30 text-warning-foreground *:data-[slot=alert-description]:text-warning-foreground/80",
        },
    },
    defaultVariants: {
        variant: "destructive",
    },
});

interface StatusAlertProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof statusAlertVariants> {
    icon?: React.ReactNode;
    title?: string;
    action?: React.ReactNode;
}

export function StatusAlert({
    className,
    variant,
    icon,
    title,
    action,
    children,
    ...props
}: StatusAlertProps) {
    return (
        <Alert
            className={cn(statusAlertVariants({ variant }), className)}
            {...props}
        >
            {icon}
            {title && <AlertTitle>{title}</AlertTitle>}
            {children && <AlertDescription>{children}</AlertDescription>}
            {action && (
                <AlertAction className="top-1/2 -translate-y-1/2 right-4">
                    {action}
                </AlertAction>
            )}
        </Alert>
    );
}

export { statusAlertVariants };
