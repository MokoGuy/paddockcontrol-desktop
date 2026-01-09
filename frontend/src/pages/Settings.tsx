import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSetup } from "@/hooks/useSetup";
import { useBackup } from "@/hooks/useBackup";
import { useKonamiCode } from "@/hooks/useKonamiCode";
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
} from "@hugeicons/core-free-icons";
import { formatDateTime } from "@/lib/theme";
import { GetBuildInfo, OpenDataDirectory } from "../../wailsjs/go/main/App";
import { ConfigEditForm } from "@/components/settings/ConfigEditForm";

export function Settings() {
    const navigate = useNavigate();
    const { config, setConfig } = useConfigStore();
    const {
        isAdminModeEnabled,
        setIsAdminModeEnabled,
        setIsSetupComplete,
        setIsWaitingForEncryptionKey,
        setIsEncryptionKeyProvided,
    } = useAppStore();
    const { isLoading: configLoading, error: configError } = useSetup();
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Enable admin mode via Konami code
    const handleKonamiSuccess = useCallback(() => {
        console.debug("[Settings] Konami code entered - admin mode enabled");
        setIsAdminModeEnabled(true);
    }, [setIsAdminModeEnabled]);
    useKonamiCode(handleKonamiSuccess);
    const {
        isLoading: backupLoading,
        error: backupError,
        exportBackup,
        getDataDirectory,
    } = useBackup();
    const [dataDir, setDataDir] = useState<string | null>(null);
    const [exportConfirming, setExportConfirming] = useState(false);
    const [resetConfirming, setResetConfirming] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const { copy, isCopied } = useCopyToClipboard();
    const [buildInfo, setBuildInfo] = useState<Record<string, string> | null>(
        null,
    );

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

    const handleExportBackup = async () => {
        try {
            await exportBackup();
            setExportConfirming(false);
        } catch (err) {
            console.error("Export error:", err);
        }
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
            <Card className="bg-destructive/10 border-destructive/30">
                <CardContent>
                    <p className="text-sm text-destructive">
                        {configError}
                    </p>
                    <Button onClick={() => navigate("/")} className="mt-4">
                        Back to Dashboard
                    </Button>
                </CardContent>
            </Card>
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
                                onClick={() => setIsEditMode(true)}
                                size="sm"
                            >
                                Edit Settings
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                    CA Name
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                    {config.ca_name}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                    Owner Email
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                    {config.owner_email}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                    Hostname Suffix
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                    {config.hostname_suffix}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                    Validity Period
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                    {config.validity_period_days} days
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                    Default Key Size
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                    {config.default_key_size} bits
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                    Default Country
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                    {config.default_country}
                                </p>
                            </div>
                        </div>

                        <div className="border-t border-border pt-6">
                            <h3 className="font-semibold text-foreground mb-4">
                                Organization Details
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                        Organization
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {config.default_organization}
                                    </p>
                                </div>
                                {config.default_organizational_unit && (
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                            Organizational Unit
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {config.default_organizational_unit}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                        City
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {config.default_city}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                        State
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {config.default_state}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-border pt-6">
                            <h3 className="font-semibold text-foreground mb-4">
                                Configuration History
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <p className="text-muted-foreground uppercase mb-1">
                                        Created
                                    </p>
                                    <p className="text-muted-foreground">
                                        {formatDateTime(config.created_at)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground uppercase mb-1">
                                        Last Modified
                                    </p>
                                    <p className="text-muted-foreground">
                                        {formatDateTime(config.last_modified)}
                                    </p>
                                </div>
                            </div>
                        </div>
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
                <Card className="mb-6 shadow-sm border-border">
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
                                        isCopied(dataDir)
                                            ? "text-success"
                                            : ""
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

            {/* Backup Management */}
            <Card className="shadow-sm border-border">
                <CardHeader>
                    <CardTitle>Backup Management</CardTitle>
                    <CardDescription>
                        Export and manage your backups
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {backupError && (
                        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg mb-4">
                            <p className="text-sm text-destructive">
                                {backupError}
                            </p>
                        </div>
                    )}

                    <p className="text-sm text-muted-foreground mb-4">
                        Create an encrypted backup of your CA configuration and
                        certificates.
                    </p>
                    <Button
                        onClick={() => setExportConfirming(true)}
                        disabled={backupLoading}
                    >
                        {backupLoading ? "Exporting..." : "Export Backup Now"}
                    </Button>
                </CardContent>
            </Card>

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

            {/* Danger Zone - disabled until admin mode enabled via Konami code */}
            <Card
                className={`mt-6 border-admin/30 bg-admin-muted ${!isAdminModeEnabled ? "opacity-60" : ""}`}
            >
                <CardContent className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-destructive">
                            Danger Zone - Reset Database
                        </p>
                        <p className="text-xs text-admin/80 mt-1">
                            Permanently delete all certificates, configuration,
                            and encryption keys.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-admin/50 text-admin hover:bg-admin/20"
                        onClick={() => setResetConfirming(true)}
                        disabled={!isAdminModeEnabled || resetLoading}
                    >
                        {resetLoading ? "Resetting..." : "Reset Database"}
                    </Button>
                </CardContent>
            </Card>

            {/* Footer */}
            <div className="mt-8 text-center text-sm text-muted-foreground">
                <p>
                    For support, visit the documentation or contact your
                    administrator
                </p>
            </div>

            {/* Export Confirmation Dialog */}
            <ConfirmDialog
                open={exportConfirming}
                title="Export Backup"
                description="Create a backup of your CA configuration and certificates?"
                confirmText="Export"
                cancelText="Cancel"
                isLoading={backupLoading}
                onConfirm={handleExportBackup}
                onCancel={() => setExportConfirming(false)}
            />

            {/* Reset Confirmation Dialog */}
            <ConfirmDialog
                open={resetConfirming}
                title="Reset Database"
                description="This will permanently delete ALL data including certificates, configuration, and encryption keys. This action cannot be undone."
                confirmText="Reset"
                cancelText="Cancel"
                isDestructive={true}
                isLoading={resetLoading}
                onConfirm={handleResetDatabase}
                onCancel={() => setResetConfirming(false)}
            />
        </>
    );
}
