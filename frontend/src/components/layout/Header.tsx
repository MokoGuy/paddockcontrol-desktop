import { useEffect, useState } from "react";
import { useThemeStore } from "@/stores/useThemeStore";
import { useAppStore } from "@/stores/useAppStore";
import { applyTheme, getTheme, setTheme, watchSystemTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Sun02Icon,
    Moon02Icon,
    Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { Quit } from "../../../wailsjs/runtime/runtime";
import { GetBuildInfo } from "../../../wailsjs/go/main/App";
import { EncryptionKeyButton } from "./EncryptionKeyButton";
import logo from "@/assets/images/logo-universal.png";

export function Header() {
    const {
        isDarkMode,
        setTheme: setStoreTheme,
        setIsDarkMode,
    } = useThemeStore();
    const { isAdminModeEnabled } = useAppStore();
    const [version, setVersion] = useState<string>("");

    useEffect(() => {
        // Fetch build info
        GetBuildInfo()
            .then((info) => {
                setVersion(info.version);
            })
            .catch(() => {
                setVersion("dev");
            });
    }, []);

    useEffect(() => {
        // Initialize theme on mount
        const currentTheme = getTheme();
        setStoreTheme(currentTheme);

        // Apply theme
        applyTheme(currentTheme);
        const isDark =
            currentTheme === "dark" ||
            (currentTheme === "system" &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);
        setIsDarkMode(isDark);

        // Watch system theme changes
        if (currentTheme === "system") {
            const unwatch = watchSystemTheme((isDark) => {
                setIsDarkMode(isDark);
            });
            return unwatch;
        }
    }, [setStoreTheme, setIsDarkMode]);

    const toggleTheme = () => {
        const newTheme = isDarkMode ? "light" : "dark";
        setTheme(newTheme);
        setStoreTheme(newTheme);
        setIsDarkMode(!isDarkMode);
    };

    return (
        <header
            className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-950"
            style={{ "--wails-draggable": "drag" } as React.CSSProperties}
        >
            <div className="max-w-4xl mx-auto flex h-16 items-center justify-between px-6">
                <div className="flex items-center gap-3">
                    <img src={logo} alt="PaddockControl" className="w-8 h-8" />
                    <div className="flex items-center gap-2">
                        <h1
                            className={`text-xl font-bold ${isAdminModeEnabled ? "text-red-600 dark:text-red-500" : "text-gray-900 dark:text-white"}`}
                        >
                            PaddockControl
                        </h1>
                        {version && (
                            <span className="text-sm text-gray-400 dark:text-gray-600">
                                v{version}
                            </span>
                        )}
                    </div>
                </div>

                {isAdminModeEnabled && (
                    <div className="absolute left-1/2 transform -translate-x-1/2">
                        <span className="text-xs font-semibold text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded border border-red-200 dark:border-red-800 flex items-center">
                            admin mode
                        </span>
                    </div>
                )}

                <div
                    className="flex items-center gap-2"
                    style={
                        {
                            "--wails-draggable": "no-drag",
                        } as React.CSSProperties
                    }
                >
                    <EncryptionKeyButton />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        title={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
                        className="text-gray-600 dark:text-gray-400 hover:bg-transparent dark:hover:bg-transparent focus-visible:ring-0 focus-visible:border-transparent active:bg-transparent"
                    >
                        <HugeiconsIcon
                            icon={isDarkMode ? Moon02Icon : Sun02Icon}
                            className="w-5 h-5"
                            strokeWidth={2}
                        />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => Quit()}
                        title="Close"
                        className="text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-transparent dark:hover:bg-transparent focus-visible:ring-0 focus-visible:border-transparent active:bg-transparent"
                    >
                        <HugeiconsIcon
                            icon={Cancel01Icon}
                            className="w-5 h-5"
                            strokeWidth={2}
                        />
                    </Button>
                </div>
            </div>
        </header>
    );
}
