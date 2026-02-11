import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
    changeEncryptionKeySchema,
    type ChangeEncryptionKeyInput,
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
import { AlertCircleIcon, Alert02Icon } from "@hugeicons/core-free-icons";

interface ChangeEncryptionKeyDialogProps {
    open: boolean;
    onClose: () => void;
}

export function ChangeEncryptionKeyDialog({
    open,
    onClose,
}: ChangeEncryptionKeyDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPasswords, setShowPasswords] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<ChangeEncryptionKeyInput>({
        resolver: zodResolver(changeEncryptionKeySchema),
    });

    const onSubmit = async (data: ChangeEncryptionKeyInput) => {
        setIsLoading(true);
        setError(null);
        try {
            await api.changeEncryptionKey(data.new_key);
            toast.success("Encryption key changed successfully");
            reset();
            onClose();
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to change encryption key";
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        reset();
        setError(null);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Change Encryption Key</DialogTitle>
                    <DialogDescription>
                        All certificate private keys will be re-encrypted with
                        the new key
                    </DialogDescription>
                </DialogHeader>

                {/* Warning */}
                <StatusAlert
                    variant="warning"
                    icon={
                        <HugeiconsIcon
                            icon={Alert02Icon}
                            className="size-4"
                            strokeWidth={2}
                        />
                    }
                >
                    Make sure to securely store your new encryption key. If you
                    lose it, you will not be able to access your private keys.
                </StatusAlert>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {error && (
                        <StatusAlert
                            variant="destructive"
                            icon={
                                <HugeiconsIcon
                                    icon={AlertCircleIcon}
                                    className="size-4"
                                    strokeWidth={2}
                                />
                            }
                        >
                            {error}
                        </StatusAlert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="new_key">New Encryption Key</Label>
                        <div className="relative">
                            <Input
                                id="new_key"
                                type={showPasswords ? "text" : "password"}
                                placeholder="Enter new encryption key (min 16 chars)"
                                disabled={isLoading}
                                {...register("new_key")}
                                className="pr-16"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPasswords(!showPasswords)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
                            >
                                {showPasswords ? "Hide" : "Show"}
                            </button>
                        </div>
                        {errors.new_key && (
                            <p className="text-sm text-destructive">
                                {errors.new_key.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="new_key_confirm">
                            Confirm New Encryption Key
                        </Label>
                        <Input
                            id="new_key_confirm"
                            type={showPasswords ? "text" : "password"}
                            placeholder="Confirm new encryption key"
                            disabled={isLoading}
                            {...register("new_key_confirm")}
                        />
                        {errors.new_key_confirm && (
                            <p className="text-sm text-destructive">
                                {errors.new_key_confirm.message}
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            variant="destructive"
                        >
                            {isLoading ? "Re-encrypting..." : "Change Key"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
