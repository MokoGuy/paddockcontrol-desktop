import { useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon, LockKeyIcon } from "@hugeicons/core-free-icons";
import { EncryptionKeyDialog } from "@/components/shared/EncryptionKeyDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export function EncryptionKeyButton() {
    const { isUnlocked, setIsUnlocked } =
        useAppStore();
    const [showUnlockDialog, setShowUnlockDialog] = useState(false);
    const [showLockConfirm, setShowLockConfirm] = useState(false);

    const handleClick = () => {
        if (isUnlocked) {
            setShowLockConfirm(true);
        } else {
            setShowUnlockDialog(true);
        }
    };

    const handleLock = async () => {
        await api.clearEncryptionKey();
        setIsUnlocked(false);
        setShowLockConfirm(false);
    };

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                onClick={handleClick}
                title={
                    isUnlocked
                        ? "Lock"
                        : "Unlock"
                }
                className={`${
                    isUnlocked
                        ? "text-success"
                        : "text-warning"
                } hover:bg-transparent dark:hover:bg-transparent focus-visible:ring-0 focus-visible:border-transparent active:bg-transparent`}
            >
                <HugeiconsIcon
                    icon={isUnlocked ? LockKeyIcon : LockIcon}
                    className="w-5 h-5"
                    strokeWidth={2}
                />
            </Button>

            <EncryptionKeyDialog
                open={showUnlockDialog}
                onClose={() => setShowUnlockDialog(false)}
            />

            <ConfirmDialog
                open={showLockConfirm}
                title="Lock"
                description="This will lock the application. You will need to enter your password again to access private key operations."
                confirmText="Lock"
                cancelText="Cancel"
                onConfirm={handleLock}
                onCancel={() => setShowLockConfirm(false)}
            />
        </>
    );
}
