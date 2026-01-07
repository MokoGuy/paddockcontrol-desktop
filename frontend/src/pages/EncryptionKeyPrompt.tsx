import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppStore } from "@/stores/useAppStore";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { api } from "@/lib/api";
import { encryptionKeySchema, type EncryptionKeyInput } from "@/lib/validation";
import logo from "@/assets/images/logo-universal.png";

export function EncryptionKeyPrompt() {
    const navigate = useNavigate();
    const {
        setIsWaitingForEncryptionKey,
        setIsEncryptionKeyProvided,
        keyValidationError,
        setKeyValidationError,
        setError,
    } = useAppStore();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<EncryptionKeyInput>({
        resolver: zodResolver(encryptionKeySchema),
    });

    const onSubmit = async (data: EncryptionKeyInput) => {
        setIsLoading(true);
        setKeyValidationError(null);
        try {
            const result = await api.provideEncryptionKey(data.key);

            if (result.valid) {
                setIsWaitingForEncryptionKey(false);
                setIsEncryptionKeyProvided(true);
                setError(null);

                // Check if setup is complete
                const isSetupComplete = await api.isSetupComplete();
                if (isSetupComplete) {
                    navigate("/dashboard", { replace: true });
                } else {
                    navigate("/setup", { replace: true });
                }
            }
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to validate encryption key";

            // Check if the error contains failed hostnames from the backend
            // The Wails error message format might include the validation result
            setKeyValidationError({
                message,
                failedHostnames: [], // Backend returns error message, we show it
            });
            reset();
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = async () => {
        setIsLoading(true);
        setKeyValidationError(null);
        try {
            await api.skipEncryptionKey();
            setIsWaitingForEncryptionKey(false);
            setIsEncryptionKeyProvided(false);
            navigate("/dashboard", { replace: true });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Failed to skip";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-xl border-slate-200 dark:border-slate-800">
                <CardHeader className="text-center space-y-4">
                    <div className="flex justify-center">
                        <img
                            src={logo}
                            alt="PaddockControl"
                            className="w-16 h-16"
                        />
                    </div>
                    <div>
                        <CardTitle className="text-2xl">Welcome Back</CardTitle>
                        <CardDescription>
                            Enter your encryption key to unlock all features
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="space-y-4"
                    >
                        {/* Key validation error display */}
                        {keyValidationError && (
                            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg">
                                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                    {keyValidationError.message}
                                </p>
                                {keyValidationError.failedHostnames.length >
                                    0 && (
                                    <div className="mt-2">
                                        <p className="text-xs text-red-700 dark:text-red-300 mb-1">
                                            Failed to decrypt keys for:
                                        </p>
                                        <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                                            {keyValidationError.failedHostnames.map(
                                                (h) => (
                                                    <li key={h}>{h}</li>
                                                ),
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="key">Encryption Key</Label>
                            <div className="relative">
                                <Input
                                    id="key"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your encryption key"
                                    disabled={isLoading}
                                    {...register("key")}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 text-sm"
                                >
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                            {errors.key && (
                                <p className="text-sm text-red-600 dark:text-red-400">
                                    {errors.key.message}
                                </p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? "Validating..." : "Unlock"}
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={handleSkip}
                            disabled={isLoading}
                        >
                            Skip for Now
                        </Button>
                    </form>

                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg">
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">
                            Skipping will limit functionality:
                        </p>
                        <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc list-inside space-y-0.5">
                            <li>Cannot generate new CSRs</li>
                            <li>Cannot import certificates</li>
                            <li>Cannot download private keys</li>
                        </ul>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                            You can provide your key later in Settings.
                        </p>
                    </div>

                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg">
                        <p className="text-xs text-blue-800 dark:text-blue-200">
                            The encryption key must be at least 16 characters
                            and is used to protect your private keys.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
