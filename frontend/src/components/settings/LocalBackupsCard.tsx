import { useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ImportCertificatesDialog } from "@/components/settings/ImportCertificatesDialog";
import { BackupDetailsDrawer } from "@/components/settings/BackupDetailsDrawer";
import { formatDateTime, getRelativeTime, formatFileSize } from "@/lib/theme";
import { LocalBackupInfo } from "@/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    DatabaseIcon,
    ArrowRight01Icon,
} from "@hugeicons/core-free-icons";

interface LocalBackupsCardProps {
    localBackups: LocalBackupInfo[];
    isLoading: boolean;
    isLoadingBackups: boolean;
    error: string | null;
    onCreateManualBackup: () => Promise<void>;
    onRestoreBackup: (filename: string) => Promise<void>;
    onDeleteBackup: (filename: string) => Promise<void>;
    isUnlocked: boolean;
}

export function LocalBackupsCard({
    localBackups,
    isLoading,
    isLoadingBackups,
    error,
    onCreateManualBackup,
    onRestoreBackup,
    onDeleteBackup,
    isUnlocked,
}: LocalBackupsCardProps) {
    const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [detailsTarget, setDetailsTarget] = useState<LocalBackupInfo | null>(
        null,
    );
    const [importOpen, setImportOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        setIsCreating(true);
        try {
            await onCreateManualBackup();
        } finally {
            setIsCreating(false);
        }
    };

    const handleRestore = async () => {
        if (!restoreTarget) return;
        try {
            await onRestoreBackup(restoreTarget);
        } finally {
            setRestoreTarget(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await onDeleteBackup(deleteTarget);
        } finally {
            setDeleteTarget(null);
        }
    };

    return (
        <>
            <Card className="mt-6 shadow-sm border-border">
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <CardTitle>Local Backups</CardTitle>
                            <CardDescription>
                                Database snapshots created automatically before
                                destructive operations or manually by you.
                            </CardDescription>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setImportOpen(true)}
                                disabled={!isUnlocked}
                                title={!isUnlocked ? "Unlock the app first to import certificates" : undefined}
                            >
                                Import Certificates
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleCreate}
                                disabled={isCreating || isLoading}
                            >
                                {isCreating
                                    ? "Creating..."
                                    : "Create Backup"}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <p className="text-xs text-destructive mb-3">
                            {error}
                        </p>
                    )}

                    {isLoadingBackups ? (
                        <div className="flex items-center justify-center py-8">
                            <LoadingSpinner text="Loading backups..." />
                        </div>
                    ) : localBackups.length === 0 ? (
                        <EmptyState
                            icon={
                                <HugeiconsIcon
                                    icon={DatabaseIcon}
                                    className="size-12"
                                    strokeWidth={1.5}
                                />
                            }
                            title="No backups yet"
                            description="Backups are created automatically before destructive operations. You can also create one manually."
                        />
                    ) : (
                        <div className="space-y-2">
                            {localBackups.map((backup) => (
                                <div
                                    key={backup.filename}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setDetailsTarget(backup)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            setDetailsTarget(backup);
                                        }
                                    }}
                                    className="flex items-center justify-between rounded-none border border-border px-3 py-2 cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Badge
                                            variant="outline"
                                            className={`w-16 justify-center ${
                                                backup.type === "manual"
                                                    ? "border-success/40 bg-success/10 text-success"
                                                    : "border-info/40 bg-info/10 text-info"
                                            }`}
                                        >
                                            {backup.type === "manual"
                                                ? "Manual"
                                                : "Auto"}
                                        </Badge>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {formatDateTime(
                                                    backup.timestamp,
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {getRelativeTime(
                                                    backup.timestamp,
                                                )}{" "}
                                                &middot;{" "}
                                                {formatFileSize(backup.size)}
                                                {" "}&middot;{" "}
                                                {backup.certificate_count}{" "}
                                                {backup.certificate_count === 1
                                                    ? "certificate"
                                                    : "certificates"}
                                                {backup.ca_name && (
                                                    <>
                                                        {" "}&middot;{" "}
                                                        {backup.ca_name}
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <HugeiconsIcon
                                        icon={ArrowRight01Icon}
                                        className="size-4 shrink-0 ml-2 text-muted-foreground"
                                        strokeWidth={2}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Restore Confirmation */}
            <ConfirmDialog
                open={restoreTarget !== null}
                title="Restore Backup"
                description="This will replace the current database with the selected backup. A safety backup will be created automatically before restoring. You may need to re-provide your encryption key after restore."
                confirmText="Restore"
                cancelText="Cancel"
                isLoading={isLoading}
                onConfirm={handleRestore}
                onCancel={() => setRestoreTarget(null)}
            />

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete Backup"
                description="This will permanently delete this backup file. This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                isDestructive
                isLoading={isLoading}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />

            {/* Backup Details Drawer */}
            <BackupDetailsDrawer
                backup={detailsTarget}
                open={detailsTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDetailsTarget(null);
                }}
                onRestore={(filename) => {
                    setDetailsTarget(null);
                    setRestoreTarget(filename);
                }}
                onDelete={(filename) => {
                    setDetailsTarget(null);
                    setDeleteTarget(filename);
                }}
                isLoading={isLoading}
            />

            {/* Import Certificates Dialog */}
            <ImportCertificatesDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                onComplete={() => {
                    // Certificates imported — caller can refresh if needed
                }}
            />
        </>
    );
}
