import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppStore } from "@/stores/useAppStore";
import { api } from "@/lib/api";
import {
    encryptionKeySchema,
    type EncryptionKeyInput,
} from "@/lib/validation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EncryptionKeyDialogProps {
    open: boolean;
    onClose: () => void;
}

export function EncryptionKeyDialog({ open, onClose }: EncryptionKeyDialogProps) {
    const {
        setIsEncryptionKeyProvided,
        keyValidationError,
        setKeyValidationError,
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
                setIsEncryptionKeyProvided(true);
                reset();
                onClose();
            }
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Invalid encryption key";

            setKeyValidationError({
                message,
                failedHostnames: [],
            });
            reset();
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        reset();
        setKeyValidationError(null);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Provide Encryption Key</DialogTitle>
                    <DialogDescription>
                        Enter your encryption key to unlock full functionality
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Error display */}
                    {keyValidationError && (
                        <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg">
                            <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                {keyValidationError.message}
                            </p>
                            {keyValidationError.failedHostnames.length > 0 && (
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
                        <Label htmlFor="dialog-key">Encryption Key</Label>
                        <div className="relative">
                            <Input
                                id="dialog-key"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your encryption key"
                                disabled={isLoading}
                                {...register("key")}
                                className="pr-16"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
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

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Validating..." : "Unlock"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
