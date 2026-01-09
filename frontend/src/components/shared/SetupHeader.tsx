import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Quit } from "../../../wailsjs/runtime/runtime";
import { ThemeToggle } from "./ThemeToggle";

interface SetupHeaderProps {
    showBackButton?: boolean;
    onBack?: () => void;
    variant?: "default" | "floating";
}

export function SetupHeader({
    showBackButton = false,
    onBack,
    variant = "default",
}: SetupHeaderProps) {
    const navigate = useNavigate();

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
                <ThemeToggle />
                <div
                    style={
                        {
                            "--wails-draggable": "no-drag",
                        } as React.CSSProperties
                    }
                >
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
                </div>
            </div>
        );
    }

    // Default variant for SetupWizard and RestoreBackup pages
    return (
        <div className="flex items-center justify-end px-4 py-4 gap-1 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm border-b border-gray-200/60 dark:border-gray-800/60 shadow-sm">
            {showBackButton && (
                <div
                    style={
                        {
                            "--wails-draggable": "no-drag",
                        } as React.CSSProperties
                    }
                    className="mr-auto"
                >
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
                </div>
            )}
            <div
                style={
                    {
                        "--wails-draggable": "no-drag",
                    } as React.CSSProperties
                }
            >
                <ThemeToggle />
            </div>
            <div
                style={
                    {
                        "--wails-draggable": "no-drag",
                    } as React.CSSProperties
                }
            >
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
            </div>
        </div>
    );
}
