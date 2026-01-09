import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/stores/useAppStore";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Quit } from "../../../wailsjs/runtime/runtime";
import { GetBuildInfo } from "../../../wailsjs/go/main/App";
import { ThemeToggle } from "./ThemeToggle";
import { EncryptionKeyButton } from "../layout/EncryptionKeyButton";
import logo from "@/assets/images/logo-universal.png";

interface AppHeaderProps {
    // Variant
    variant?: "default" | "floating";

    // Left side
    showBackButton?: boolean;
    onBack?: () => void;

    // Center
    showTitle?: boolean;
    title?: string;

    // Right side
    showAdminBadge?: boolean;
    showEncryptionKey?: boolean;
    showThemeToggle?: boolean;
    showCloseButton?: boolean;
}

export function AppHeader({
    variant = "default",
    showBackButton = false,
    onBack,
    showTitle = false,
    title = "PaddockControl",
    showAdminBadge = false,
    showEncryptionKey = false,
    showThemeToggle = true,
    showCloseButton = true,
}: AppHeaderProps) {
    const navigate = useNavigate();
    const { isAdminModeEnabled, setIsAdminModeEnabled } = useAppStore();
    const [version, setVersion] = useState<string>("");

    useEffect(() => {
        if (showTitle) {
            // Fetch build info
            GetBuildInfo()
                .then((info) => {
                    setVersion(info.version);
                })
                .catch(() => {
                    setVersion("dev");
                });
        }
    }, [showTitle]);

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate("/setup", { replace: true });
        }
    };

    // Floating variant for SetupChoice page
    if (variant === "floating") {
        return (
            <div
                className="absolute top-4 right-4 flex items-center gap-1 z-10"
                style={
                    { "--wails-draggable": "no-drag" } as React.CSSProperties
                }
            >
                {showThemeToggle && <ThemeToggle />}
                {showCloseButton && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => Quit()}
                        title="Close"
                        className="text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                    >
                        <HugeiconsIcon
                            icon={Cancel01Icon}
                            className="w-5 h-5"
                            strokeWidth={2}
                        />
                    </Button>
                )}
            </div>
        );
    }

    // Default variant - header bar
    return (
        <header
            className="flex items-center justify-between px-4 h-16 gap-1 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm border-b border-gray-200/60 dark:border-gray-800/60 shadow-sm"
            style={{ "--wails-draggable": "drag" } as React.CSSProperties}
        >
            {/* Left side - Back button */}
            <div
                className="flex items-center"
                style={
                    { "--wails-draggable": "no-drag" } as React.CSSProperties
                }
            >
                {showBackButton ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBack}
                        title="Back"
                        className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <HugeiconsIcon
                            icon={ArrowLeft01Icon}
                            className="w-5 h-5"
                            strokeWidth={2}
                        />
                    </Button>
                ) : (
                    // Invisible spacer to maintain layout symmetry
                    <div className="w-10 h-10" />
                )}
            </div>

            {/* Center - Logo, Title and Version */}
            {showTitle && (
                <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
                    <img src={logo} alt="PaddockControl" className="w-8 h-8" />
                    <div className="flex items-center gap-2">
                        <h1
                            className={`text-lg font-bold ${isAdminModeEnabled && showAdminBadge ? "text-red-600 dark:text-red-500" : "text-gray-900 dark:text-white"}`}
                        >
                            {title}
                        </h1>
                        {version && (
                            <span className="text-sm text-gray-400 dark:text-gray-600">
                                v{version}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Right side - Admin badge, Encryption key, Theme toggle, Close button */}
            <div
                className="flex items-center gap-1"
                style={
                    { "--wails-draggable": "no-drag" } as React.CSSProperties
                }
            >
                {showAdminBadge && isAdminModeEnabled && (
                    <span className="text-xs font-semibold text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-950 pl-2 pr-1 py-0.5 rounded border border-red-200 dark:border-red-800 flex items-center gap-1">
                        admin mode
                        <button
                            onClick={() => setIsAdminModeEnabled(false)}
                            className="hover:bg-red-100 dark:hover:bg-red-900 rounded p-0.5 transition-colors"
                            title="Disable admin mode"
                        >
                            <HugeiconsIcon
                                icon={Cancel01Icon}
                                className="w-3 h-3"
                                strokeWidth={2}
                            />
                        </button>
                    </span>
                )}
                {showEncryptionKey && <EncryptionKeyButton />}
                {showThemeToggle && <ThemeToggle />}
                {showCloseButton && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => Quit()}
                        title="Close"
                        className="text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                    >
                        <HugeiconsIcon
                            icon={Cancel01Icon}
                            className="w-5 h-5"
                            strokeWidth={2}
                        />
                    </Button>
                )}
            </div>
        </header>
    );
}
