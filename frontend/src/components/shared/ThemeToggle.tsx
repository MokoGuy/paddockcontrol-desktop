import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Sun02Icon, Moon02Icon } from "@hugeicons/core-free-icons";
import { useThemeStore } from "@/stores/useThemeStore";
import { getTheme, setTheme, applyTheme } from "@/lib/theme";

export function ThemeToggle() {
    const {
        isDarkMode,
        setTheme: setStoreTheme,
        setIsDarkMode,
    } = useThemeStore();

    useEffect(() => {
        const currentTheme = getTheme();
        setStoreTheme(currentTheme);
        applyTheme(currentTheme);
        const isDark =
            currentTheme === "dark" ||
            (currentTheme === "system" &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);
        setIsDarkMode(isDark);
    }, [setStoreTheme, setIsDarkMode]);

    const toggleTheme = () => {
        const newTheme = isDarkMode ? "light" : "dark";
        setTheme(newTheme);
        setStoreTheme(newTheme);
        setIsDarkMode(!isDarkMode);
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
            className={`text-gray-600 dark:text-gray-400 hover:bg-transparent dark:hover:bg-transparent focus-visible:ring-0 focus-visible:border-transparent active:bg-transparent ${
                isDarkMode
                    ? "hover:text-blue-500 dark:hover:text-blue-400"
                    : "hover:text-yellow-500 dark:hover:text-yellow-400"
            }`}
        >
            <HugeiconsIcon
                icon={isDarkMode ? Moon02Icon : Sun02Icon}
                className="w-5 h-5"
                strokeWidth={2}
            />
        </Button>
    );
}
