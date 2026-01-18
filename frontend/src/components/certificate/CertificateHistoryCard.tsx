import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    FileAddIcon,
    CloudUploadIcon,
    FileImportIcon,
    Delete02Icon,
    LockIcon,
    LockKeyIcon,
    RefreshIcon,
    ArrowDown01Icon,
    ArrowUp01Icon,
    Clock01Icon,
    Package01Icon,
} from "@hugeicons/core-free-icons";
import { getRelativeTime } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/types";

interface CertificateHistoryCardProps {
    history: HistoryEntry[];
    isLoading: boolean;
    error: string | null;
}

const COLLAPSED_LIMIT = 5;

// Map event types to icons and colors
function getEventIcon(eventType: string) {
    switch (eventType) {
        case "csr_generated":
            return { icon: FileAddIcon, color: "text-info" };
        case "csr_regenerated":
            return { icon: RefreshIcon, color: "text-amber-500" };
        case "certificate_uploaded":
            return { icon: CloudUploadIcon, color: "text-success" };
        case "certificate_imported":
            return { icon: FileImportIcon, color: "text-success" };
        case "certificate_restored":
            return { icon: Package01Icon, color: "text-info" };
        case "certificate_deleted":
            return { icon: Delete02Icon, color: "text-destructive" };
        case "readonly_enabled":
            return { icon: LockIcon, color: "text-muted-foreground" };
        case "readonly_disabled":
            return { icon: LockKeyIcon, color: "text-muted-foreground" };
        default:
            return { icon: Clock01Icon, color: "text-muted-foreground" };
    }
}

export function CertificateHistoryCard({
    history,
    isLoading,
    error,
}: CertificateHistoryCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const displayedHistory = useMemo(() => {
        if (isExpanded || history.length <= COLLAPSED_LIMIT) {
            return history;
        }
        return history.slice(0, COLLAPSED_LIMIT);
    }, [history, isExpanded]);

    const hasMore = history.length > COLLAPSED_LIMIT;

    if (isLoading) {
        return (
            <Card className="mb-6 shadow-sm border-border">
                <CardHeader>
                    <CardTitle>Activity History</CardTitle>
                    <CardDescription>Loading history...</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-center py-4">
                        <LoadingSpinner />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="mb-6 shadow-sm border-border">
                <CardHeader>
                    <CardTitle>Activity History</CardTitle>
                    <CardDescription className="text-destructive">
                        {error}
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (history.length === 0) {
        return (
            <Card className="mb-6 shadow-sm border-border">
                <CardHeader>
                    <CardTitle>Activity History</CardTitle>
                    <CardDescription>
                        No activity recorded yet
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="mb-6 shadow-sm border-border">
            <CardHeader>
                <CardTitle>Activity History</CardTitle>
                <CardDescription>
                    {history.length} event{history.length !== 1 ? "s" : ""}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-0">
                    <AnimatePresence mode="popLayout">
                        {displayedHistory.map((entry, index) => {
                            const { icon, color } = getEventIcon(entry.event_type);
                            const isLast = index === displayedHistory.length - 1;

                            return (
                                <motion.div
                                    key={entry.id}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.15, delay: index * 0.02 }}
                                    className={cn(
                                        "flex items-start gap-3 py-2.5",
                                        !isLast && "border-b border-border/50"
                                    )}
                                >
                                    <div className={cn("mt-0.5 shrink-0", color)}>
                                        <HugeiconsIcon
                                            icon={icon}
                                            className="w-4 h-4"
                                            strokeWidth={2}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-foreground">
                                            {entry.message}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {getRelativeTime(entry.created_at)}
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {hasMore && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full mt-2 text-muted-foreground hover:text-foreground"
                    >
                        <HugeiconsIcon
                            icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
                            className="w-4 h-4 mr-1"
                            strokeWidth={2}
                        />
                        {isExpanded
                            ? "Show less"
                            : `Show ${history.length - COLLAPSED_LIMIT} more`}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
