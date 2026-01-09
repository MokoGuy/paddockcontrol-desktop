import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Sun02Icon, Moon02Icon } from "@hugeicons/core-free-icons";
import { useThemeStore } from "@/stores/useThemeStore";
import { setTheme } from "@/lib/theme";

export function ThemeToggle() {
    const { isDarkMode, setIsDarkMode } = useThemeStore();

    const toggleTheme = () => {
        const newTheme = isDarkMode ? "light" : "dark";
        setTheme(newTheme); // Saves to localStorage and applies to DOM
        setIsDarkMode(!isDarkMode); // Updates store
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
            className={`text-muted-foreground hover:bg-transparent dark:hover:bg-transparent focus-visible:ring-0 focus-visible:border-transparent active:bg-transparent ${
                isDarkMode
                    ? "hover:text-primary"
                    : "hover:text-warning"
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
