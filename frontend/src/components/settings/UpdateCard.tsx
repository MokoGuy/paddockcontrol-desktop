import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusAlert } from "@/components/shared/StatusAlert";
import { useUpdateStore } from "@/stores/useUpdateStore";
import { api } from "@/lib/api";
import { formatFileSize } from "@/lib/theme";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    AlertCircleIcon,
    Tick02Icon,
    Download04Icon,
} from "@hugeicons/core-free-icons";
import { OpenURL } from "../../../wailsjs/go/main/App";

export function UpdateCard() {
    const {
        updateInfo,
        setUpdateInfo,
        updateState,
        setUpdateState,
        errorMessage,
        setErrorMessage,
    } = useUpdateStore();

    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    // Load any cached update info on mount
    useEffect(() => {
        if (!updateInfo) {
            api.checkForUpdate()
                .then((info) => {
                    setUpdateInfo(info);
                    setLastChecked(new Date());
                })
                .catch(() => {
                    // Silently ignore — startup check may not have completed
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCheckForUpdates = async () => {
        setUpdateState("checking");
        setErrorMessage(null);
        try {
            const info = await api.checkForUpdateManual();
            setUpdateInfo(info);
            setLastChecked(new Date());
            setUpdateState("idle");
        } catch (err) {
            setErrorMessage(
                err instanceof Error ? err.message : "Failed to check for updates",
            );
            setUpdateState("error");
        }
    };

    const handleDownloadAndApply = async () => {
        setUpdateState("downloading");
        setErrorMessage(null);
        try {
            await api.downloadAndApplyUpdate();
            setUpdateState("complete");
        } catch (err) {
            setErrorMessage(
                err instanceof Error ? err.message : "Update failed",
            );
            setUpdateState("error");
        }
    };

    const handleRestart = async () => {
        try {
            await api.restartApp();
        } catch (err) {
            setErrorMessage(
                err instanceof Error ? err.message : "Failed to restart",
            );
            setUpdateState("error");
        }
    };

    const handleViewRelease = () => {
        if (updateInfo?.release_url) {
            OpenURL(updateInfo.release_url);
        }
    };

    const isUpdateAvailable =
        updateInfo?.update_available && updateState !== "complete";

    return (
        <Card className="mt-6 shadow-sm border-border">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Application Updates</CardTitle>
                        <CardDescription>
                            Check for and install new versions
                        </CardDescription>
                    </div>
                    {updateState === "complete" ? (
                        <Button size="sm" onClick={handleRestart}>
                            Restart Now
                        </Button>
                    ) : updateState === "downloading" ? (
                        <Button size="sm" disabled>
                            <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                            Downloading...
                        </Button>
                    ) : updateState === "checking" ? (
                        <Button size="sm" variant="outline" disabled>
                            <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                            Checking...
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCheckForUpdates}
                        >
                            Check for Updates
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Error State */}
                {updateState === "error" && errorMessage && (
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
                        {errorMessage}
                        <Button
                            variant="link"
                            size="sm"
                            className="ml-2 h-auto p-0"
                            onClick={handleCheckForUpdates}
                        >
                            Retry
                        </Button>
                    </StatusAlert>
                )}

                {/* Update Complete */}
                {updateState === "complete" && (
                    <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                        <HugeiconsIcon
                            icon={Tick02Icon}
                            className="size-4 shrink-0"
                            strokeWidth={2}
                        />
                        Update downloaded successfully. Restart the application
                        to finish updating.
                    </div>
                )}

                {/* Update Available */}
                {isUpdateAvailable &&
                    updateState !== "error" &&
                    updateState !== "downloading" && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <HugeiconsIcon
                                    icon={Download04Icon}
                                    className="size-5 text-primary"
                                    strokeWidth={2}
                                />
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">
                                        {updateInfo!.latest_version}
                                    </span>
                                    <Badge variant="secondary" className="text-xs">
                                        New
                                    </Badge>
                                    {updateInfo!.asset_size > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            {formatFileSize(updateInfo!.asset_size)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {updateInfo!.release_notes && (
                                <div className="border border-border bg-muted/50 p-3">
                                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                                        Release Notes
                                    </p>
                                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-a:text-primary">
                                        <ReactMarkdown>{updateInfo!.release_notes}</ReactMarkdown>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    onClick={handleDownloadAndApply}
                                    disabled={updateInfo!.current_version === "dev"}
                                >
                                    Download & Install
                                </Button>
                                {updateInfo!.release_url && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleViewRelease}
                                    >
                                        View on GitHub
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                {/* Up to date */}
                {!isUpdateAvailable &&
                    updateState !== "error" &&
                    updateState !== "complete" &&
                    updateState !== "checking" &&
                    updateState !== "downloading" && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <HugeiconsIcon
                                icon={Tick02Icon}
                                className="size-4 text-emerald-500"
                                strokeWidth={2}
                            />
                            <span>You're up to date</span>
                            {updateInfo?.current_version && (
                                <Badge variant="outline" className="text-xs">
                                    {updateInfo.current_version}
                                </Badge>
                            )}
                        </div>
                    )}

                {/* Last checked */}
                {lastChecked && updateState === "idle" && (
                    <p className="text-xs text-muted-foreground">
                        Last checked:{" "}
                        {lastChecked.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
