import { useNavigate } from "react-router-dom";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import logo from "@/assets/images/logo-universal.png";

export function SetupChoice() {
    const navigate = useNavigate();

    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="text-center space-y-4 mb-8">
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
            <div
                className="flex flex-col gap-6 max-w-2xl mx-auto"
                style={
                    {
                        "--wails-draggable": "no-drag",
                    } as React.CSSProperties
                }
            >
                {/* New Setup */}
                <Card
                    className="cursor-pointer hover:shadow-lg transition-all shadow-sm border-gray-200 dark:border-gray-800 group"
                    onClick={() => navigate("/setup/wizard")}
                >
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl shrink-0">✨</span>
                                <div>
                                    <CardTitle className="text-xl">
                                        New Setup
                                    </CardTitle>
                                    <CardDescription>
                                        Start fresh with a new certificate
                                        manager
                                    </CardDescription>
                                </div>
                            </div>
                            <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 group-hover:translate-x-1 transition-all shrink-0"
                                strokeWidth={2}
                            />
                        </div>
                    </CardHeader>
                </Card>

                {/* Restore from Backup */}
                <Card
                    className="cursor-pointer hover:shadow-lg transition-all shadow-sm border-gray-200 dark:border-gray-800 group"
                    onClick={() => navigate("/setup/restore")}
                >
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl shrink-0">📦</span>
                                <div>
                                    <CardTitle className="text-xl">
                                        Restore from Backup
                                    </CardTitle>
                                    <CardDescription>
                                        Restore your certificates from a backup
                                        file
                                    </CardDescription>
                                </div>
                            </div>
                            <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 group-hover:translate-x-1 transition-all shrink-0"
                                strokeWidth={2}
                            />
                        </div>
                    </CardHeader>
                </Card>
            </div>
        </div>
    );
}
