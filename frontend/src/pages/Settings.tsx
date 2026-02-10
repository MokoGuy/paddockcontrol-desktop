import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetup } from "@/hooks/useSetup";
import { useBackup } from "@/hooks/useBackup";
import { useConfigStore } from "@/stores/useConfigStore";
import { useAppStore } from "@/stores/useAppStore";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { UpdateConfigRequest } from "@/types";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
    InputGroup,
    InputGroupInput,
    InputGroupButton,
} from "@/components/ui/input-group";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Copy01Icon,
    Tick02Icon,
    FolderLinksIcon,
    AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { StatusAlert } from "@/components/shared/StatusAlert";
import { formatDateTime, formatFileSize } from "@/lib/theme";
import { GetBuildInfo, OpenDataDirectory, ExportLogs, GetLogInfo } from "../../wailsjs/go/main/App";
import { logger } from "../../wailsjs/go/models";
import { ConfigEditForm } from "@/components/settings/ConfigEditForm";
import { ChangeEncryptionKeyDialog } from "@/components/settings/ChangeEncryptionKeyDialog";
import { LocalBackupsCard } from "@/components/settings/LocalBackupsCard";
import { ReviewSection, ReviewField } from "@/components/shared/ReviewField";

export function Settings() {
    const navigate = useNavigate();
    const { config, setConfig } = useConfigStore();
    const {
        isAdminModeEnabled,
        setIsAdminModeEnabled,
        setIsSetupComplete,
        setIsWaitingForEncryptionKey,
        isEncryptionKeyProvided,
        setIsEncryptionKeyProvided,
    } = useAppStore();
    const { isLoading: configLoading, error: configError } = useSetup();
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const {
        isLoading: backupLoading,
        error: backupError,
        exportBackup,
        getDataDirectory,
        localBackups,
        isLoadingBackups,
        listLocalBackups,
        createManualBackup,
        restoreLocalBackup,
        deleteLocalBackup,
    } = useBackup();
    const [dataDir, setDataDir] = useState<string | null>(null);
    const [resetConfirming, setResetConfirming] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [changeKeyOpen, setChangeKeyOpen] = useState(false);
    const { copy, isCopied } = useCopyToClipboard();
    const [buildInfo, setBuildInfo] = useState<Record<string, string> | null>(
        null,
    );
    const [logInfo, setLogInfo] = useState<logger.LogFileInfo | null>(null);
    const [logExportLoading, setLogExportLoading] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            // Load configuration
            try {
                const cfg = await api.getConfig();
                setConfig(cfg);
            } catch (err) {
                console.error("Failed to load config:", err);
            }

            // Load data directory
            const dir = await getDataDirectory();
            if (dir) {
                setDataDir(dir);
            }

            // Load build info
            try {
                const info = await GetBuildInfo();
                setBuildInfo(info);
            } catch (err) {
                console.error("Failed to load build info:", err);
            }

            // Load log info
            try {
                const logs = await GetLogInfo();
                setLogInfo(logs);
            } catch (err) {
                console.error("Failed to load log info:", err);
            }

            // Load local backups
            await listLocalBackups();
        };

        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleOpenDataDirectory = async () => {
        try {
            await OpenDataDirectory();
        } catch (err) {
            console.error("Failed to open data directory:", err);
        }
    };

    const handleRestoreBackup = async (filename: string) => {
        await restoreLocalBackup(filename);
        // Reset frontend state — the restored DB may have different state
        setIsEncryptionKeyProvided(false);
        toast.info(
            "Backup restored. You may need to re-provide your encryption key.",
        );
        // Re-load settings data
        try {
            const cfg = await api.getConfig();
            setConfig(cfg);
        } catch {
            // Config may not exist in restored DB
        }
        await listLocalBackups();
    };

    const handleResetDatabase = async () => {
        setResetLoading(true);
        try {
            await api.resetDatabase();
            // Reset frontend state to initial values
            setIsSetupComplete(false);
            setIsWaitingForEncryptionKey(true);
            setIsEncryptionKeyProvided(false);
            setIsAdminModeEnabled(false);
            // Navigate to setup wizard
            navigate("/setup", { replace: true });
        } catch (err) {
            console.error("Reset error:", err);
            setResetLoading(false);
            setResetConfirming(false);
        }
    };

    const handleExportLogs = async () => {
        setLogExportLoading(true);
        try {
            await ExportLogs();
            toast.success("Logs exported successfully");
        } catch (err) {
            console.error("Export logs error:", err);
            toast.error(`Failed to export logs: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setLogExportLoading(false);
        }
    };

    const handleEditConfig = async (data: UpdateConfigRequest) => {
        setIsSaving(true);
        try {
            const updatedConfig = await api.updateConfig(data);
            setConfig(updatedConfig);
            toast.success("Settings updated successfully");
            setIsEditMode(false);
        } catch (err) {
            console.error("Failed to update config:", err);
            toast.error(
                `Failed to update settings: ${err instanceof Error ? err.message : "Unknown error"}`,
            );
        } finally {
            setIsSaving(false);
        }
    };

    if (configLoading && !config) {
        return (
            <div className="flex items-center justify-center py-12">
                <LoadingSpinner text="Loading settings..." />
            </div>
        );
    }

    if (configError) {
        return (
            <div className="space-y-4">
                <StatusAlert
                    variant="destructive"
                    icon={
                        <HugeiconsIcon
                            icon={AlertCircleIcon}
                            className="size-4"
                            strokeWidth={2}
                        />
                    }
                >
                    {configError}
                </StatusAlert>
                <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
            </div>
        );
    }

    return (
        <>
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">
                        Settings
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage configuration and backups
                    </p>
                </div>
                <Button variant="outline" onClick={() => navigate("/")}>
                    ← Back
                </Button>
            </div>

            {/* Configuration */}
            {config && (
                <Card className="mb-6 shadow-sm border-border">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>CA Configuration</CardTitle>
                                <CardDescription>
                                    Your certificate authority settings
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setIsEditMode(true)}
                                size="sm"
                            >
                                Edit Settings
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <ReviewSection title="CA Configuration">
                            <ReviewField label="CA Name" value={config.ca_name} />
                            <ReviewField label="Owner Email" value={config.owner_email} />
                            <ReviewField label="Hostname Suffix" value={config.hostname_suffix} />
                        </ReviewSection>

                        <ReviewSection title="Certificate Defaults">
                            <ReviewField label="Validity Period" value={`${config.validity_period_days} days`} />
                            <ReviewField label="Key Size" value={`${config.default_key_size} bits`} />
                        </ReviewSection>

                        <ReviewSection title="Organization">
                            <ReviewField label="Organization" value={config.default_organization} />
                            <ReviewField label="Organizational Unit" value={config.default_organizational_unit} />
                            <ReviewField label="City" value={config.default_city} />
                            <ReviewField label="State" value={config.default_state} />
                            <ReviewField label="Country" value={config.default_country} />
                        </ReviewSection>

                        <ReviewSection title="Configuration History">
                            <ReviewField label="Created" value={formatDateTime(config.created_at)} />
                            <ReviewField label="Last Modified" value={formatDateTime(config.last_modified)} />
                        </ReviewSection>
                    </CardContent>
                </Card>
            )}

            {/* Edit Configuration Modal */}
            {config && (
                <ConfigEditForm
                    config={{
                        owner_email: config.owner_email,
                        ca_name: config.ca_name,
                        hostname_suffix: config.hostname_suffix,
                        validity_period_days: config.validity_period_days,
                        default_organization: config.default_organization,
                        default_organizational_unit:
                            config.default_organizational_unit || "",
                        default_city: config.default_city,
                        default_state: config.default_state,
                        default_country: config.default_country,
                        default_key_size: config.default_key_size,
                    }}
                    onSave={handleEditConfig}
                    onCancel={() => setIsEditMode(false)}
                    isLoading={isSaving}
                    open={isEditMode}
                />
            )}

            {/* Data Directory */}
            {dataDir && (
                <Card className="mt-6 shadow-sm border-border">
                    <CardHeader>
                        <CardTitle>Data Directory</CardTitle>
                        <CardDescription>
                            Where your certificates are stored
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <InputGroup>
                            <InputGroupInput
                                value={dataDir}
                                readOnly
                                className="font-mono"
                            />
                            <InputGroupButton
                                size="icon-xs"
                                onClick={() => copy(dataDir)}
                            >
                                <HugeiconsIcon
                                    icon={
                                        isCopied(dataDir)
                                            ? Tick02Icon
                                            : Copy01Icon
                                    }
                                    className={
                                        isCopied(dataDir) ? "text-success" : ""
                                    }
                                    strokeWidth={2}
                                />
                            </InputGroupButton>
                            <InputGroupButton
                                size="icon-xs"
                                onClick={handleOpenDataDirectory}
                                title="Open folder in explorer"
                            >
                                <HugeiconsIcon
                                    icon={FolderLinksIcon}
                                    strokeWidth={2}
                                />
                            </InputGroupButton>
                        </InputGroup>
                        <p className="text-xs text-muted-foreground">
                            All certificate data, backups, and application files
                            are stored in this directory.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Local Backups */}
            <LocalBackupsCard
                localBackups={localBackups}
                isLoading={backupLoading}
                isLoadingBackups={isLoadingBackups}
                isAdminModeEnabled={isAdminModeEnabled}
                error={backupError}
                onCreateManualBackup={createManualBackup}
                onRestoreBackup={handleRestoreBackup}
                onDeleteBackup={deleteLocalBackup}
                onExportBackup={exportBackup}
                backupLoading={backupLoading}
            />

            {/* Application Logs */}
            {logInfo && (
                <Card className="mt-6 shadow-sm border-border">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Application Logs</CardTitle>
                                <CardDescription>
                                    Log files for debugging and troubleshooting
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportLogs}
                                disabled={logExportLoading}
                            >
                                {logExportLoading ? "Exporting..." : "Export Logs"}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                    Current Log Size
                                </p>
                                <p className="font-mono text-foreground">
                                    {formatFileSize(logInfo.currentLogSize)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                    Rotated Logs
                                </p>
                                <p className="font-mono text-muted-foreground">
                                    {logInfo.rotatedLogCount} files
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                    Total Size
                                </p>
                                <p className="font-mono text-muted-foreground">
                                    {formatFileSize(logInfo.totalLogsSize)}
                                </p>
                            </div>
                            {logInfo.oldestLogDate && (
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                        Oldest Log
                                    </p>
                                    <p className="font-mono text-muted-foreground">
                                        {formatDateTime(logInfo.oldestLogDate)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Build Information */}
            {buildInfo && (
                <Card className="mt-6 shadow-sm border-border">
                    <CardHeader>
                        <CardTitle>Build Information</CardTitle>
                        <CardDescription>
                            Application version and build details
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                    Version
                                </p>
                                <p className="font-mono text-foreground">
                                    {buildInfo.version}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                    Build Time
                                </p>
                                <p className="font-mono text-muted-foreground">
                                    {buildInfo.buildTime}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                    Git Commit
                                </p>
                                <p className="font-mono text-muted-foreground">
                                    {buildInfo.gitCommit}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                    Go Version
                                </p>
                                <p className="font-mono text-muted-foreground">
                                    {buildInfo.goVersion}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Change Encryption Key */}
            <Card
                className={`mt-6 border-admin/30 bg-admin-muted ${!isAdminModeEnabled ? "opacity-60" : ""}`}
            >
                <CardContent className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-destructive">
                            Danger Zone - Change Encryption Key
                        </p>
                        <p className="text-xs text-admin/80 mt-1">
                            Re-encrypt all private keys with a new encryption
                            key.
                        </p>
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-admin/50 text-admin hover:bg-admin/20"
                                    onClick={() => setChangeKeyOpen(true)}
                                    disabled={
                                        !isAdminModeEnabled ||
                                        !isEncryptionKeyProvided
                                    }
                                >
                                    Change Key
                                </Button>
                            </span>
                        </TooltipTrigger>
                        {!isAdminModeEnabled && (
                            <TooltipContent>Admin mode required</TooltipContent>
                        )}
                        {isAdminModeEnabled && !isEncryptionKeyProvided && (
                            <TooltipContent>
                                Encryption key required
                            </TooltipContent>
                        )}
                    </Tooltip>
                </CardContent>
            </Card>

            {/* Danger Zone - Reset Database */}
            <Card
                className={`mt-4 border-admin/30 bg-admin-muted ${!isAdminModeEnabled ? "opacity-60" : ""}`}
            >
                <CardContent className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-destructive">
                            Danger Zone - Reset Database
                        </p>
                        <p className="text-xs text-admin/80 mt-1">
                            Permanently delete all certificates, configuration,
                            and encryption keys. A backup is created automatically.
                        </p>
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-admin/50 text-admin hover:bg-admin/20"
                                    onClick={() => setResetConfirming(true)}
                                    disabled={!isAdminModeEnabled || resetLoading}
                                >
                                    {resetLoading ? "Resetting..." : "Reset Database"}
                                </Button>
                            </span>
                        </TooltipTrigger>
                        {!isAdminModeEnabled && (
                            <TooltipContent>Admin mode required</TooltipContent>
                        )}
                    </Tooltip>
                </CardContent>
            </Card>

            {/* Footer */}
            <div className="mt-8 text-center text-sm text-muted-foreground">
                <p>
                    For support, visit the documentation or contact your
                    administrator
                </p>
            </div>

            {/* Reset Confirmation Dialog */}
            <ConfirmDialog
                open={resetConfirming}
                title="Reset Database"
                description="This will permanently delete ALL data including certificates, configuration, and encryption keys. An automatic backup will be created before reset. This action cannot be undone."
                confirmText="Reset"
                cancelText="Cancel"
                isDestructive={true}
                isLoading={resetLoading}
                onConfirm={handleResetDatabase}
                onCancel={() => setResetConfirming(false)}
            />

            {/* Change Encryption Key Dialog */}
            <ChangeEncryptionKeyDialog
                open={changeKeyOpen}
                onClose={() => setChangeKeyOpen(false)}
            />
        </>
    );
}
