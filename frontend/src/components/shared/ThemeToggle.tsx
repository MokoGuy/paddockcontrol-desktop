import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import { Sun02Icon, Moon02Icon } from "@hugeicons/core-free-icons";
import { ThemeToggler } from "@/components/animate-ui/primitives/effects/theme-toggler";
import { IconButton } from "@/components/animate-ui/components/buttons/icon";

export function ThemeToggle() {
    const { theme, resolvedTheme, setTheme } = useTheme();

    return (
        <ThemeToggler
            theme={theme as "light" | "dark" | "system"}
            resolvedTheme={resolvedTheme as "light" | "dark"}
            setTheme={setTheme}
        >
            {({ resolved, toggleTheme }) => (
                <IconButton
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleTheme(resolved === "dark" ? "light" : "dark")}
                    title={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
                >
                    <HugeiconsIcon
                        icon={resolved === "dark" ? Moon02Icon : Sun02Icon}
                        className="w-5 h-5"
                        strokeWidth={2}
                    />
                </IconButton>
            )}
        </ThemeToggler>
    );
}
