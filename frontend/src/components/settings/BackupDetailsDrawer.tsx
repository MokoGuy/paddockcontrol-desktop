import { useEffect, useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AdminGatedButton } from "@/components/shared/AdminGatedButton";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/certificate/StatusBadge";
import { useBackup } from "@/hooks/useBackup";
import {
    formatDate,
    formatDateTime,
    getRelativeTime,
    formatFileSize,
} from "@/lib/theme";
import { LocalBackupInfo, BackupPeekInfo } from "@/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Delete02Icon,
    DatabaseRestoreIcon,
    DatabaseIcon,
} from "@hugeicons/core-free-icons";

interface BackupDetailsDrawerProps {
    backup: LocalBackupInfo | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRestore: (filename: string) => void;
    onDelete: (filename: string) => void;
    isLoading: boolean;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 py-1.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xs font-medium text-foreground text-right">
                {value}
            </span>
        </div>
    );
}

export function BackupDetailsDrawer({
    backup,
    open,
    onOpenChange,
    onRestore,
    onDelete,
    isLoading,
}: BackupDetailsDrawerProps) {
    const { peekLocalBackup } = useBackup();
    const [info, setInfo] = useState<BackupPeekInfo | null>(null);
    const [isPeeking, setIsPeeking] = useState(false);
    const [peekError, setPeekError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !backup) return;

        let cancelled = false;
        setInfo(null);
        setPeekError(null);
        setIsPeeking(true);

        peekLocalBackup(backup.filename)
            .then((result) => {
                if (cancelled) return;
                if (result) {
                    setInfo(result);
                } else {
                    setPeekError("Could not read this backup's contents.");
                }
            })
            .finally(() => {
                if (!cancelled) setIsPeeking(false);
            });

        return () => {
            cancelled = true;
        };
        // peekLocalBackup is stable for the drawer's lifetime
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, backup?.filename]);

    const isManual = backup?.type === "manual";

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="top-16 bottom-0 h-[calc(100%-4rem)]"
            >
                <SheetHeader>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className={`w-16 justify-center ${
                                isManual
                                    ? "border-success/40 bg-success/10 text-success"
                                    : "border-info/40 bg-info/10 text-info"
                            }`}
                        >
                            {isManual ? "Manual" : "Auto"}
                        </Badge>
                        <SheetTitle>Backup Details</SheetTitle>
                    </div>
                    <SheetDescription>
                        {backup ? formatDateTime(backup.timestamp) : ""}
                    </SheetDescription>
                </SheetHeader>

                {backup && (
                    <div className="flex-1 flex flex-col gap-4 min-h-0">
                        <div className="border border-border px-3 py-2">
                            <DetailRow
                                label="Created"
                                value={getRelativeTime(backup.timestamp)}
                            />
                            <DetailRow
                                label="Size"
                                value={formatFileSize(backup.size)}
                            />
                            <DetailRow
                                label="Filename"
                                value={
                                    <span className="font-mono break-all">
                                        {backup.filename}
                                    </span>
                                }
                            />
                        </div>

                        {isPeeking ? (
                            <div className="flex items-center justify-center py-8">
                                <LoadingSpinner text="Reading backup..." />
                            </div>
                        ) : peekError ? (
                            <p className="text-xs text-destructive">
                                {peekError}
                            </p>
                        ) : info ? (
                            <>
                                <div className="border border-border px-3 py-2">
                                    <DetailRow
                                        label="Certificates"
                                        value={info.certificate_count}
                                    />
                                    <DetailRow
                                        label="CA name"
                                        value={info.ca_name || "—"}
                                    />
                                    <DetailRow
                                        label="Schema version"
                                        value={info.schema_version}
                                    />
                                    <DetailRow
                                        label="Security keys"
                                        value={
                                            info.has_security_keys
                                                ? "Yes"
                                                : "No"
                                        }
                                    />
                                </div>

                                <div className="flex-1 flex flex-col min-h-0">
                                    <p className="text-xs font-medium text-foreground mb-2">
                                        Certificates
                                    </p>
                                    {info.certificates &&
                                    info.certificates.length > 0 ? (
                                        <div className="flex-1 space-y-2 overflow-y-auto">
                                            {info.certificates.map((cert) => (
                                                <div
                                                    key={cert.hostname}
                                                    className="border border-border px-3 py-2"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-xs font-mono font-medium text-foreground truncate">
                                                            {cert.hostname}
                                                        </p>
                                                        <StatusBadge
                                                            status={cert.status}
                                                        />
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Created:{" "}
                                                        {formatDate(
                                                            cert.created_at,
                                                        )}
                                                    </p>
                                                    {cert.expires_at && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Expires:{" "}
                                                            {formatDate(
                                                                cert.expires_at,
                                                            )}
                                                        </p>
                                                    )}
                                                    {cert.key_size ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            Key Size:{" "}
                                                            {cert.key_size} bits
                                                        </p>
                                                    ) : null}
                                                    {cert.sans &&
                                                        cert.sans.length > 0 && (
                                                            <div className="mt-1 text-xs text-muted-foreground">
                                                                <span className="font-medium">
                                                                    SANs
                                                                </span>
                                                                <ul className="mt-0.5 list-disc pl-4 space-y-0.5">
                                                                    {cert.sans.map(
                                                                        (san) => (
                                                                            <li
                                                                                key={
                                                                                    san
                                                                                }
                                                                                className="break-all"
                                                                            >
                                                                                {
                                                                                    san
                                                                                }
                                                                            </li>
                                                                        ),
                                                                    )}
                                                                </ul>
                                                            </div>
                                                        )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState
                                            icon={
                                                <HugeiconsIcon
                                                    icon={DatabaseIcon}
                                                    className="size-10"
                                                    strokeWidth={1.5}
                                                />
                                            }
                                            title="No certificates"
                                            description="This backup contains no certificates."
                                        />
                                    )}
                                </div>
                            </>
                        ) : null}
                    </div>
                )}

                <Separator />
                <SheetFooter className="flex-row justify-end">
                    <AdminGatedButton
                        variant="outline"
                        size="sm"
                        disabled={isLoading || !backup}
                        onClick={() => backup && onRestore(backup.filename)}
                    >
                        <HugeiconsIcon
                            icon={DatabaseRestoreIcon}
                            className="size-3.5 mr-1"
                            strokeWidth={2}
                        />
                        Restore
                    </AdminGatedButton>
                    <AdminGatedButton
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={isLoading || !backup}
                        onClick={() => backup && onDelete(backup.filename)}
                    >
                        <HugeiconsIcon
                            icon={Delete02Icon}
                            className="size-3.5 mr-1"
                            strokeWidth={2}
                        />
                        Delete
                    </AdminGatedButton>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
