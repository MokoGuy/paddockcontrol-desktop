import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useAppStore } from "@/stores/useAppStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, ArrowLeft01Icon, MinusSignIcon, SquareIcon } from "@hugeicons/core-free-icons";
import { Quit, WindowMinimise, WindowToggleMaximise } from "../../../wailsjs/runtime/runtime";
import { GetBuildInfo } from "../../../wailsjs/go/main/App";
import { ThemeToggle } from "./ThemeToggle";
import { EncryptionKeyButton } from "../layout/EncryptionKeyButton";
import { getCssColorAsRgb } from "@/lib/theme";
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
    showWindowControls?: boolean;
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
    showWindowControls = true,
    showCloseButton = true,
}: AppHeaderProps) {
    const navigate = useNavigate();
    const { isAdminModeEnabled, setIsAdminModeEnabled } = useAppStore();
    const { isDarkMode } = useThemeStore();
    const [version, setVersion] = useState<string>("");
    const [showPulse, setShowPulse] = useState(false);
    const prevAdminMode = useRef(isAdminModeEnabled);

    // Compute animation colors from CSS variables (handles OKLCH to RGB conversion)
    const { normalColor, adminColor } = useMemo(() => ({
        normalColor: getCssColorAsRgb('--foreground'),
        adminColor: getCssColorAsRgb('--admin'),
    }), [isDarkMode]);

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
                {showWindowControls && (
                    <>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => WindowMinimise()}
                            title="Minimize"
                            className="text-muted-foreground"
                        >
                            <HugeiconsIcon
                                icon={MinusSignIcon}
                                className="w-4 h-4"
                                strokeWidth={2}
                            />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => WindowToggleMaximise()}
                            title="Maximize"
                            className="text-muted-foreground"
                        >
                            <HugeiconsIcon
                                icon={SquareIcon}
                                className="w-4 h-4"
                                strokeWidth={2}
                            />
                        </Button>
                    </>
                )}
                {showCloseButton && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => Quit()}
                        title="Close"
                        className="text-muted-foreground hover:text-destructive"
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
            className="relative h-16 bg-background/80 backdrop-blur-sm border-b border-border/60 shadow-sm"
            style={{ "--wails-draggable": "drag" } as React.CSSProperties}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
        >
            {/* Admin mode animated border - left side */}
            <motion.div
                className="absolute bottom-0 left-0 w-1/2 h-[2px] bg-admin"
                style={{ transformOrigin: "left" }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isAdminModeEnabled && showAdminBadge ? 1 : 0 }}
                transition={{
                    duration: 0.4,
                    ease: isAdminModeEnabled ? [0.34, 1.56, 0.64, 1] : "easeInOut",
                    delay: isAdminModeEnabled ? 0.1 : 0,
                }}
            />
            {/* Admin mode animated border - right side */}
            <motion.div
                className="absolute bottom-0 right-0 w-1/2 h-[2px] bg-admin"
                style={{ transformOrigin: "right" }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isAdminModeEnabled && showAdminBadge ? 1 : 0 }}
                transition={{
                    duration: 0.4,
                    ease: isAdminModeEnabled ? [0.34, 1.56, 0.64, 1] : "easeInOut",
                    delay: isAdminModeEnabled ? 0.1 : 0,
                }}
            />
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-1">
                {/* Left side - Back button */}
                <div
                    className="flex items-center"
                    style={
                        {
                            "--wails-draggable": "no-drag",
                        } as React.CSSProperties
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
                                    className="text-muted-foreground hover:bg-muted"
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
                            className={`w-8 h-8 ${isDarkMode ? "invert" : ""}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, delay: 0.1 }}
                        />
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold">
                                {title.split("").map((char, index) => {
                                    const targetColor =
                                        isAdminModeEnabled && showAdminBadge
                                            ? adminColor
                                            : normalColor;

                                    return (
                                        <motion.span
                                            key={`${char}-${index}-${isDarkMode}`}
                                            initial={{
                                                opacity: 0,
                                                color: normalColor,
                                            }}
                                            animate={{
                                                opacity: 1,
                                                color: targetColor,
                                            }}
                                            transition={{
                                                opacity: {
                                                    duration: 0.05,
                                                    delay: index * 0.03 + 0.2,
                                                    ease: "easeInOut",
                                                },
                                                color: {
                                                    duration: 0.1,
                                                    delay: isAdminModeEnabled
                                                        ? index * 0.04 + 0.2
                                                        : index * 0.04,
                                                    ease: "easeInOut",
                                                },
                                            }}
                                        >
                                            {char}
                                        </motion.span>
                                    );
                                })}
                            </h1>
                            {version && (
                                <motion.span
                                    className="text-sm text-muted-foreground/60"
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
                        {
                            "--wails-draggable": "no-drag",
                        } as React.CSSProperties
                    }
                >
                    <AnimatePresence>
                        {showAdminBadge && isAdminModeEnabled && (
                            <motion.span
                                className="text-xs font-semibold text-admin bg-admin-muted pl-2 pr-1 py-0.5 rounded border border-admin/30 flex items-center gap-1 relative"
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
                                            className="absolute inset-0 rounded border-2 border-admin"
                                            initial={{ opacity: 0.8, scale: 1 }}
                                            animate={{ opacity: 0, scale: 2 }}
                                            transition={{ duration: 0.3 }}
                                        />
                                        <motion.span
                                            className="absolute inset-0 rounded bg-admin"
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
                                    className="hover:bg-admin/20 rounded p-0.5 transition-colors"
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
                    {showWindowControls && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => WindowMinimise()}
                                title="Minimize"
                                className="text-muted-foreground hover:bg-transparent dark:hover:bg-transparent"
                            >
                                <HugeiconsIcon
                                    icon={MinusSignIcon}
                                    className="w-4 h-4"
                                    strokeWidth={2}
                                />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => WindowToggleMaximise()}
                                title="Maximize"
                                className="text-muted-foreground hover:bg-transparent dark:hover:bg-transparent"
                            >
                                <HugeiconsIcon
                                    icon={SquareIcon}
                                    className="w-4 h-4"
                                    strokeWidth={2}
                                />
                            </Button>
                        </>
                    )}
                    {showCloseButton && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => Quit()}
                            title="Close"
                            className="text-muted-foreground hover:text-destructive hover:bg-transparent dark:hover:bg-transparent"
                        >
                            <HugeiconsIcon
                                icon={Cancel01Icon}
                                className="w-5 h-5"
                                strokeWidth={2}
                            />
                        </Button>
                    )}
                </div>
            </div>
        </motion.header>
    );
}
