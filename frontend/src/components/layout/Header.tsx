import { useEffect } from "react";
import { useThemeStore } from "@/stores/useThemeStore";
import { applyTheme, getTheme, setTheme, watchSystemTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Sun02Icon, Moon02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { Quit } from "../../../wailsjs/runtime/runtime";
import { EncryptionKeyButton } from "./EncryptionKeyButton";
import logo from "@/assets/images/logo-universal.png";

export function Header() {
    const {
        isDarkMode,
        setTheme: setStoreTheme,
        setIsDarkMode,
    } = useThemeStore();

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
            <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
                <div className="flex items-center gap-3">
                    <img src={logo} alt="PaddockControl" className="w-8 h-8" />
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        PaddockControl
                    </h1>
                </div>

                <div
                    className="flex items-center gap-2"
                    style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
                >
                    <EncryptionKeyButton />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        title={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
                        className="text-gray-600 dark:text-gray-400"
                    >
                        <HugeiconsIcon
                            icon={isDarkMode ? Sun02Icon : Moon02Icon}
                            className="w-5 h-5"
                            strokeWidth={2}
                        />
                    </Button>
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
        </header>
    );
}
