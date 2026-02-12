import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppStore } from "@/stores/useAppStore";
import { api } from "@/lib/api";
import {
    passwordSchema,
    type PasswordInput,
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
import { StatusAlert } from "@/components/shared/StatusAlert";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";

interface EncryptionKeyDialogProps {
    open: boolean;
    onClose: () => void;
}

export function EncryptionKeyDialog({ open, onClose }: EncryptionKeyDialogProps) {
    const {
        setIsUnlocked,
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
    } = useForm<PasswordInput>({
        resolver: zodResolver(passwordSchema),
    });

    const onSubmit = async (data: PasswordInput) => {
        setIsLoading(true);
        setKeyValidationError(null);
        try {
            const result = await api.provideEncryptionKey(data.key);

            if (result.valid) {
                setIsUnlocked(true);
                reset();
                onClose();
            }
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Invalid password";

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
                    <DialogTitle>Unlock PaddockControl</DialogTitle>
                    <DialogDescription>
                        Enter your password to unlock full functionality
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Error display */}
                    {keyValidationError && (
                        <StatusAlert
                            variant="destructive"
                            icon={
                                <HugeiconsIcon
                                    icon={AlertCircleIcon}
                                    className="size-4"
                                    strokeWidth={2}
                                />
                            }
                            title={keyValidationError.message}
                        >
                            {keyValidationError.failedHostnames.length > 0 && (
                                <>
                                    <p className="text-xs opacity-80 mb-1">
                                        Failed to decrypt keys for:
                                    </p>
                                    <ul className="text-xs opacity-70 list-disc list-inside">
                                        {keyValidationError.failedHostnames.map(
                                            (h) => (
                                                <li key={h}>{h}</li>
                                            ),
                                        )}
                                    </ul>
                                </>
                            )}
                        </StatusAlert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="dialog-key">Password</Label>
                        <div className="relative">
                            <Input
                                id="dialog-key"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                disabled={isLoading}
                                {...register("key")}
                                className="pr-16"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </div>
                        {errors.key && (
                            <p className="text-sm text-destructive">
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
