import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { StatusAlert } from "@/components/shared/StatusAlert";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon, Key01Icon } from "@hugeicons/core-free-icons";

interface PrivateKeySectionProps {
    isEncryptionKeyProvided: boolean;
    privateKeyPEM: string | null;
    privateKeyLoading: boolean;
    privateKeyError: string | null;
    onUnlockClick: () => void;
    onDownloadClick: () => void;
}

export function PrivateKeySection({
    isEncryptionKeyProvided,
    privateKeyPEM,
    privateKeyLoading,
    privateKeyError,
    onUnlockClick,
    onDownloadClick,
}: PrivateKeySectionProps) {
    if (!isEncryptionKeyProvided) {
        return (
            <StatusAlert
                variant="warning"
                className="mb-6"
                icon={
                    <HugeiconsIcon
                        icon={Key01Icon}
                        className="size-4"
                        strokeWidth={2}
                    />
                }
                title="Private Key (PEM)"
                action={
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-warning/50 text-warning-foreground hover:bg-warning/20"
                        onClick={onUnlockClick}
                    >
                        Unlock
                    </Button>
                }
            >
                Provide your encryption key to view and download the private key
            </StatusAlert>
        );
    }

    return (
        <Card className="mb-6 shadow-sm border-border">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HugeiconsIcon
                            icon={Key01Icon}
                            className="w-5 h-5"
                            strokeWidth={2}
                        />
                        <div>
                            <CardTitle>Private Key (PEM)</CardTitle>
                            <CardDescription>
                                RSA private key in PEM format
                            </CardDescription>
                        </div>
                    </div>
                    {privateKeyPEM && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onDownloadClick}
                        >
                            <HugeiconsIcon
                                icon={Download04Icon}
                                className="w-4 h-4 mr-1"
                                strokeWidth={2}
                            />
                            Download
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {privateKeyLoading ? (
                    <LoadingSpinner text="Decrypting private key..." />
                ) : privateKeyError ? (
                    <p className="text-sm text-destructive">
                        {privateKeyError}
                    </p>
                ) : privateKeyPEM ? (
                    <CodeBlock content={privateKeyPEM} />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No private key available
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
