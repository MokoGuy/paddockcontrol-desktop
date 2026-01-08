import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSetup } from "@/hooks/useSetup";
import { useBackup } from "@/hooks/useBackup";
import { useKonamiCode } from "@/hooks/useKonamiCode";
import { useConfigStore } from "@/stores/useConfigStore";
import { useAppStore } from "@/stores/useAppStore";
import { api } from "@/lib/api";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
    InputGroup,
    InputGroupInput,
    InputGroupButton,
} from "@/components/ui/input-group";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { formatDateTime } from "@/lib/theme";

export function Settings() {
    const navigate = useNavigate();
    const { config } = useConfigStore();
    const {
        isAdminModeEnabled,
        setIsAdminModeEnabled,
        setIsSetupComplete,
        setIsWaitingForEncryptionKey,
        setIsEncryptionKeyProvided,
    } = useAppStore();
    const { isLoading: configLoading, error: configError } = useSetup();

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

    useEffect(() => {
        loadDataDirectory();
    }, []);

    const loadDataDirectory = async () => {
        const dir = await getDataDirectory();
        if (dir) {
            setDataDir(dir);
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

    if (configLoading && !config) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
                <Header />
                <div className="flex items-center justify-center min-h-[60vh]">
                    <LoadingSpinner text="Loading settings..." />
                </div>
            </div>
        );
    }

    if (configError) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
                <Header />
                <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900">
                        <CardContent>
                            <p className="text-sm text-red-800 dark:text-red-200">
                                {configError}
                            </p>
                            <Button
                                onClick={() => navigate("/")}
                                className="mt-4"
                            >
                                Back to Dashboard
                            </Button>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <Header />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Settings
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Manage configuration and backups
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => navigate("/")}
                    >
                        ← Back
                    </Button>
                </div>

                {/* Configuration */}
                {config && (
                    <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
                        <CardHeader>
                            <CardTitle>CA Configuration</CardTitle>
                            <CardDescription>
                                Your certificate authority settings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                                        CA Name
                                    </p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {config.ca_name}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                                        Owner Email
                                    </p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {config.owner_email}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                                        Hostname Suffix
                                    </p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {config.hostname_suffix}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                                        Validity Period
                                    </p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {config.validity_period_days} days
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                                        Default Key Size
                                    </p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {config.default_key_size} bits
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                                        Default Country
                                    </p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {config.default_country}
                                    </p>
                                </div>
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                                    Organization Details
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                                            Organization
                                        </p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                            {config.default_organization}
                                        </p>
                                    </div>
                                    {config.default_organizational_unit && (
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                                                Organizational Unit
                                            </p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                                {
                                                    config.default_organizational_unit
                                                }
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                                            City
                                        </p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                            {config.default_city}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                                            State
                                        </p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                            {config.default_state}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                                    Configuration History
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <p className="text-gray-500 dark:text-gray-400 uppercase mb-1">
                                            Created
                                        </p>
                                        <p className="text-gray-700 dark:text-gray-300">
                                            {formatDateTime(config.created_at)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 dark:text-gray-400 uppercase mb-1">
                                            Last Modified
                                        </p>
                                        <p className="text-gray-700 dark:text-gray-300">
                                            {formatDateTime(
                                                config.last_modified,
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Data Directory */}
                {dataDir && (
                    <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
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
                                                ? "text-green-500"
                                                : ""
                                        }
                                        strokeWidth={2}
                                    />
                                </InputGroupButton>
                            </InputGroup>
                            <p className="text-xs text-muted-foreground">
                                All certificate data, backups, and application
                                files are stored in this directory.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Backup Management */}
                <Card className="shadow-sm border-gray-200 dark:border-gray-800">
                    <CardHeader>
                        <CardTitle>Backup Management</CardTitle>
                        <CardDescription>
                            Export and manage your backups
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {backupError && (
                            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg">
                                <p className="text-sm text-red-800 dark:text-red-200">
                                    {backupError}
                                </p>
                            </div>
                        )}

                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                                Export Backup
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Create a complete backup of your CA
                                configuration and all certificates. The backup
                                file will be encrypted and saved to your data
                                directory.
                            </p>
                            <Button
                                onClick={() => setExportConfirming(true)}
                                disabled={backupLoading}
                            >
                                {backupLoading
                                    ? "Exporting..."
                                    : "Export Backup Now"}
                            </Button>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                                About Backups
                            </h3>
                            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                                <li className="flex items-start gap-2">
                                    <span className="text-green-600 dark:text-green-400 font-bold mt-0.5">
                                        ✓
                                    </span>
                                    <span>
                                        Backups include your complete CA
                                        configuration
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-600 dark:text-green-400 font-bold mt-0.5">
                                        ✓
                                    </span>
                                    <span>
                                        All certificates and their metadata are
                                        backed up
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-600 dark:text-green-400 font-bold mt-0.5">
                                        ✓
                                    </span>
                                    <span>
                                        Private keys are encrypted with your
                                        encryption key
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-600 dark:text-green-400 font-bold mt-0.5">
                                        ✓
                                    </span>
                                    <span>
                                        Backups are portable and can be restored
                                        on any system
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                {/* Danger Zone - disabled until admin mode enabled via Konami code */}
                <Card
                    className={`mt-6 border-red-200 dark:border-red-900 ${
                        isAdminModeEnabled
                            ? "bg-red-50 dark:bg-red-950"
                            : "bg-red-50/50 dark:bg-red-950/50 opacity-60"
                    }`}
                >
                    <CardContent className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                Danger Zone - Reset Database
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                Permanently delete all certificates, configuration,
                                and encryption keys.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900"
                            onClick={() => setResetConfirming(true)}
                            disabled={!isAdminModeEnabled || resetLoading}
                        >
                            {resetLoading ? "Resetting..." : "Reset Database"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                    <p>
                        For support, visit the documentation or contact your
                        administrator
                    </p>
                </div>
            </main>

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
        </div>
    );
}
