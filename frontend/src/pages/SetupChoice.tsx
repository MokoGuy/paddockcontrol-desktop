import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
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
    const text = "Welcome to PaddockControl";

    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="text-center space-y-4 mb-8">
                <motion.img
                    src={logo}
                    alt="PaddockControl"
                    className="w-16 h-16 mx-auto"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                />
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {text.split("").map((char, index) => (
                            <motion.span
                                key={`${char}-${index}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{
                                    duration: 0.05,
                                    delay: index * 0.05 + 0.3,
                                    ease: "easeInOut",
                                }}
                            >
                                {char}
                            </motion.span>
                        ))}
                    </h1>
                    <motion.p
                        className="text-gray-600 dark:text-gray-400 mt-2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 1.6 }}
                    >
                        Choose how you would like to set up your certificate
                        manager
                    </motion.p>
                </div>
            </div>

            {/* Options */}
            <motion.div
                className="flex flex-col gap-6 max-w-2xl mx-auto"
                style={
                    {
                        "--wails-draggable": "no-drag",
                    } as React.CSSProperties
                }
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.8 }}
            >
                {/* New Setup */}
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    <Card
                        className="cursor-pointer hover:shadow-lg transition-all shadow-sm border-gray-200 dark:border-gray-800 group"
                        onClick={() => navigate("/setup/wizard")}
                    >
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl shrink-0">
                                        ✨
                                    </span>
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
                </motion.div>

                {/* Restore from Backup */}
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    <Card
                        className="cursor-pointer hover:shadow-lg transition-all shadow-sm border-gray-200 dark:border-gray-800 group"
                        onClick={() => navigate("/setup/restore")}
                    >
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl shrink-0">
                                        📦
                                    </span>
                                    <div>
                                        <CardTitle className="text-xl">
                                            Restore from Backup
                                        </CardTitle>
                                        <CardDescription>
                                            Restore your certificates from a
                                            backup file
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
                </motion.div>
            </motion.div>
        </div>
    );
}
