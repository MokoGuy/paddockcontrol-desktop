import { useNavigate } from "react-router-dom";
import {
    Card,
    CardContent,
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
                            authority
                        </p>
                    </div>
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* New Setup */}
                    <Card className="cursor-pointer hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all border-slate-200 dark:border-slate-800 flex flex-col">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="text-xl">
                                        New Setup
                                    </CardTitle>
                                    <CardDescription>
                                        Start fresh with a new certificate
                                        authority
                                    </CardDescription>
                                </div>
                                <span className="text-3xl">✨</span>
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col flex-1">
                            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex items-start gap-2">
                                    <span className="text-green-600">✓</span>
                                    <span>Configure your CA from scratch</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-green-600">✓</span>
                                    <span>Set up organization details</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-green-600">✓</span>
                                    <span>
                                        Define default certificate settings
                                    </span>
                                </div>
                            </div>
                            <div className="mt-auto pt-4">
                                <Button
                                    onClick={() => navigate("/setup/wizard")}
                                    className="w-full"
                                >
                                    Continue with New Setup
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Restore from Backup */}
                    <Card className="cursor-pointer hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all border-slate-200 dark:border-slate-800 flex flex-col">
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
                        <CardContent className="flex flex-col flex-1">
                            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex items-start gap-2">
                                    <span className="text-green-600">✓</span>
                                    <span>Load existing CA configuration</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-green-600">✓</span>
                                    <span>Restore all your certificates</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-green-600">✓</span>
                                    <span>Recover from a previous backup</span>
                                </div>
                            </div>
                            <div className="mt-auto pt-4">
                                <Button
                                    onClick={() => navigate("/setup/restore")}
                                    variant="outline"
                                    className="w-full"
                                >
                                    Restore from Backup
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Info Box */}
                <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
                    <CardContent>
                        <div className="flex gap-3">
                            <span className="text-xl">ℹ️</span>
                            <div className="text-sm text-blue-800 dark:text-blue-200">
                                <p className="font-semibold mb-1">
                                    What is a backup?
                                </p>
                                <p>
                                    A backup file contains your CA
                                    configuration, all certificates, and
                                    encrypted private keys. You can safely store
                                    and restore it anytime.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
