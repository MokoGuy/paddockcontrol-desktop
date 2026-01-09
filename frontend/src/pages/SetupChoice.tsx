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
    const part1 = "Welcome to";
    const part2 = "PaddockControl";
    const part1Delay = 0.3;
    const part1CharDelay = 0.02;
    const part1Duration = part1.length * part1CharDelay;
    const pauseBetweenParts = 0.5;
    const part2Delay = part1Delay + part1Duration + pauseBetweenParts;
    const part2CharDelay = 0.05;
    const part2Duration = part2.length * part2CharDelay;

    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Title Area - fixed height to prevent layout shift */}
            <div className="text-center mb-12 relative h-28">
                {/* Phase 1: "Welcome to" - types out, then fades */}
                <motion.h1
                    className="text-3xl font-bold text-foreground absolute inset-x-0 top-1/2 -translate-y-1/2"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{
                        duration: 0.3,
                        delay: part2Delay - 0.3,
                        ease: "easeInOut",
                    }}
                >
                    {part1.split("").map((char, index) => (
                        <motion.span
                            key={`part1-${char}-${index}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{
                                duration: 0.05,
                                delay: part1Delay + index * part1CharDelay,
                                ease: "easeInOut",
                            }}
                        >
                            {char}
                        </motion.span>
                    ))}
                </motion.h1>

                {/* Phase 2: Logo + "PaddockControl" */}
                <motion.div
                    className="absolute inset-x-0 top-0 space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                        duration: 0.3,
                        delay: part2Delay,
                        ease: "easeOut",
                    }}
                >
                    <motion.img
                        src={logo}
                        alt="PaddockControl"
                        className="w-16 h-16 mx-auto"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{
                            duration: 0.3,
                            delay: part2Delay,
                            ease: "easeOut",
                        }}
                    />
                    <h1 className="text-3xl font-bold text-foreground">
                        {part2.split("").map((char, index) => (
                            <motion.span
                                key={`part2-${char}-${index}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{
                                    duration: 0.05,
                                    delay: part2Delay + index * part2CharDelay,
                                    ease: "easeInOut",
                                }}
                            >
                                {char}
                            </motion.span>
                        ))}
                    </h1>
                </motion.div>
            </div>

            {/* Description + Options */}
            <div className="flex flex-col gap-6 max-w-2xl mx-auto">
                <motion.p
                    className="text-muted-foreground text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                        duration: 0.3,
                        delay: part2Delay + part2Duration,
                    }}
                >
                    Choose how you would like to set up your certificate manager
                </motion.p>

                <motion.div
                    className="flex flex-col gap-6"
                    style={
                        {
                            "--wails-draggable": "no-drag",
                        } as React.CSSProperties
                    }
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.4,
                        delay: part2Delay + part2Duration + 0.1,
                    }}
                >
                    {/* New Setup */}
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 17,
                        }}
                    >
                        <Card
                            className="cursor-pointer hover:shadow-lg transition-all shadow-sm border-border group"
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
                                                Start fresh with a new
                                                certificate manager
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <HugeiconsIcon
                                        icon={ArrowRight01Icon}
                                        className="w-5 h-5 text-muted-foreground/60 group-hover:text-muted-foreground group-hover:translate-x-1 transition-all shrink-0"
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
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 17,
                        }}
                    >
                        <Card
                            className="cursor-pointer hover:shadow-lg transition-all shadow-sm border-border group"
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
                                        className="w-5 h-5 text-muted-foreground/60 group-hover:text-muted-foreground group-hover:translate-x-1 transition-all shrink-0"
                                        strokeWidth={2}
                                    />
                                </div>
                            </CardHeader>
                        </Card>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
