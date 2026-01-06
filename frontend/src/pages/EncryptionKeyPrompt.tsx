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
    const { setIsWaitingForEncryptionKey, setError } = useAppStore();
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
        try {
            await api.provideEncryptionKey(data.key);
            setIsWaitingForEncryptionKey(false);
            setError(null);

            // Check if setup is complete
            const isSetupComplete = await api.isSetupComplete();
            if (isSetupComplete) {
                navigate("/dashboard", { replace: true });
            } else {
                navigate("/setup", { replace: true });
            }
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to validate encryption key";
            setError(message);
            reset();
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
                            Enter your encryption key to continue
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="space-y-4"
                    >
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
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400"
                                >
                                    {showPassword ? "👁️" : "👁️‍🗨️"}
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
                    </form>

                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg">
                        <p className="text-xs text-blue-800 dark:text-blue-200">
                            💡 The encryption key must be at least 16 characters
                            and is used to protect your private keys.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
