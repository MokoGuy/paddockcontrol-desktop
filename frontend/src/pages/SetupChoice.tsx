import { useNavigate } from "react-router-dom";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Sun02Icon,
    Moon02Icon,
    Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { useThemeStore } from "@/stores/useThemeStore";
import { getTheme, setTheme, applyTheme } from "@/lib/theme";
import { Quit } from "../../wailsjs/runtime/runtime";
import { useEffect } from "react";
import logo from "@/assets/images/logo-universal.png";

export function SetupChoice() {
    const navigate = useNavigate();
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
        <div
            className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4"
            style={{ "--wails-draggable": "drag" } as React.CSSProperties}
        >
            {/* Top-right controls */}
            <div
                className="fixed top-4 right-4 flex items-center gap-1"
                style={
                    { "--wails-draggable": "no-drag" } as React.CSSProperties
                }
            >
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

            <div className="w-full max-w-2xl space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <img
                        src={logo}
                        alt="PaddockControl"
                        className="w-16 h-16 mx-auto"
                    />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Welcome to PaddockControl
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">
                            Choose how you would like to set up your certificate
                            manager
                        </p>
                    </div>
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* New Setup */}
                    <Card
                        className="cursor-pointer hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all border-slate-200 dark:border-slate-800"
                        onClick={() => navigate("/setup/wizard")}
                    >
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="text-xl">
                                        New Setup
                                    </CardTitle>
                                    <CardDescription>
                                        Start fresh with a new certificate
                                        manager
                                    </CardDescription>
                                </div>
                                <span className="text-3xl">✨</span>
                            </div>
                        </CardHeader>
                    </Card>

                    {/* Restore from Backup */}
                    <Card
                        className="cursor-pointer hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all border-slate-200 dark:border-slate-800"
                        onClick={() => navigate("/setup/restore")}
                    >
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="text-xl">
                                        Restore from Backup
                                    </CardTitle>
                                    <CardDescription>
                                        Restore your certificates from a backup
                                        file
                                    </CardDescription>
                                </div>
                                <span className="text-3xl">📦</span>
                            </div>
                        </CardHeader>
                    </Card>
                </div>
            </div>
        </div>
    );
}
