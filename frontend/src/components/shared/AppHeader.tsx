import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
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
    const [showPulse, setShowPulse] = useState(false);
    const prevAdminMode = useRef(isAdminModeEnabled);

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

    // Trigger pulse animation when admin mode is enabled
    useEffect(() => {
        if (isAdminModeEnabled && !prevAdminMode.current) {
            // Schedule state update to avoid cascading renders
            setTimeout(() => setShowPulse(true), 0);
            const timer = setTimeout(() => setShowPulse(false), 1200);
            return () => clearTimeout(timer);
        }
        prevAdminMode.current = isAdminModeEnabled;
    }, [isAdminModeEnabled]);

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

    // Default variant - header bar with subtle animations
    return (
        <motion.header
            className="flex items-center justify-between px-4 h-16 gap-1 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm border-b border-gray-200/60 dark:border-gray-800/60 shadow-sm"
            style={{ "--wails-draggable": "drag" } as React.CSSProperties}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
        >
            {/* Left side - Back button */}
            <div
                className="flex items-center"
                style={
                    { "--wails-draggable": "no-drag" } as React.CSSProperties
                }
            >
                <AnimatePresence mode="wait">
                    {showBackButton ? (
                        <motion.div
                            key="back-button"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
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
                        </motion.div>
                    ) : (
                        // Invisible spacer to maintain layout symmetry
                        <div key="spacer" className="w-10 h-10" />
                    )}
                </AnimatePresence>
            </div>

            {/* Center - Logo, Title and Version */}
            {showTitle && (
                <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
                    <motion.img
                        src={logo}
                        alt="PaddockControl"
                        className="w-8 h-8"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                    />
                    <div className="flex items-center gap-2">
                        <h1
                            className={`text-lg font-bold ${isAdminModeEnabled && showAdminBadge ? "text-red-600 dark:text-red-500" : "text-gray-900 dark:text-white"}`}
                        >
                            {title.split("").map((char, index) => (
                                <motion.span
                                    key={`${char}-${index}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{
                                        duration: 0.05,
                                        delay: index * 0.03 + 0.2,
                                        ease: "easeInOut",
                                    }}
                                >
                                    {char}
                                </motion.span>
                            ))}
                        </h1>
                        {version && (
                            <motion.span
                                className="text-sm text-gray-400 dark:text-gray-600"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3, delay: 0.65 }}
                            >
                                v{version}
                            </motion.span>
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
                <AnimatePresence>
                    {showAdminBadge && isAdminModeEnabled && (
                        <motion.span
                            className="text-xs font-semibold text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-950 pl-2 pr-1 py-0.5 rounded border border-red-200 dark:border-red-800 flex items-center gap-1 relative"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{
                                opacity: 1,
                                scale: [0, 1.15, 1],
                            }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{
                                duration: 0.3,
                                ease: [0.34, 1.56, 0.64, 1], // Elastic ease
                            }}
                        >
                            {/* Pulse and glow effect on enable */}
                            {showPulse && (
                                <>
                                    <motion.span
                                        className="absolute inset-0 rounded border-2 border-red-500"
                                        initial={{ opacity: 0.8, scale: 1 }}
                                        animate={{ opacity: 0, scale: 2 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                    <motion.span
                                        className="absolute inset-0 rounded bg-red-500"
                                        initial={{ opacity: 0.4, scale: 1 }}
                                        animate={{ opacity: 0, scale: 2.5 }}
                                        transition={{ duration: 1.2 }}
                                        style={{ filter: "blur(10px)" }}
                                    />
                                </>
                            )}
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
                        </motion.span>
                    )}
                </AnimatePresence>
                {showEncryptionKey && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                    >
                        <EncryptionKeyButton />
                    </motion.div>
                )}
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
        </motion.header>
    );
}
