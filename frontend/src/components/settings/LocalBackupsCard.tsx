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
import { AdminGatedButton } from "@/components/shared/AdminGatedButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDateTime, getRelativeTime, formatFileSize } from "@/lib/theme";
import { LocalBackupInfo } from "@/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Delete02Icon,
    DatabaseRestoreIcon,
    DatabaseIcon,
} from "@hugeicons/core-free-icons";

interface LocalBackupsCardProps {
    localBackups: LocalBackupInfo[];
    isLoading: boolean;
    isLoadingBackups: boolean;
    error: string | null;
    onCreateManualBackup: () => Promise<void>;
    onRestoreBackup: (filename: string) => Promise<void>;
    onDeleteBackup: (filename: string) => Promise<void>;
    onExportBackup: () => Promise<void>;
    backupLoading: boolean;
}

export function LocalBackupsCard({
    localBackups,
    isLoading,
    isLoadingBackups,
    error,
    onCreateManualBackup,
    onRestoreBackup,
    onDeleteBackup,
    onExportBackup,
    backupLoading,
}: LocalBackupsCardProps) {
    const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [exportConfirming, setExportConfirming] = useState(false);
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

    const handleExport = async () => {
        try {
            await onExportBackup();
        } finally {
            setExportConfirming(false);
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
                                onClick={() => setExportConfirming(true)}
                                disabled={backupLoading}
                            >
                                {backupLoading
                                    ? "Exporting..."
                                    : "Export JSON"}
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
                                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
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
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                        <AdminGatedButton
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setRestoreTarget(
                                                    backup.filename,
                                                )
                                            }
                                            disabled={isLoading}
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
                                            onClick={() =>
                                                setDeleteTarget(
                                                    backup.filename,
                                                )
                                            }
                                            disabled={isLoading}
                                        >
                                            <HugeiconsIcon
                                                icon={Delete02Icon}
                                                className="size-3.5"
                                                strokeWidth={2}
                                            />
                                        </AdminGatedButton>
                                    </div>
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

            {/* Export JSON Confirmation */}
            <ConfirmDialog
                open={exportConfirming}
                title="Export Backup"
                description="Create a JSON backup of your CA configuration and certificates?"
                confirmText="Export"
                cancelText="Cancel"
                isLoading={backupLoading}
                onConfirm={handleExport}
                onCancel={() => setExportConfirming(false)}
            />
        </>
    );
}
