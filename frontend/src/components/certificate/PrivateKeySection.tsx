import { useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { StatusAlert } from "@/components/shared/StatusAlert";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Key01Icon,
    ArrowDown01Icon,
    ArrowUp01Icon,
} from "@hugeicons/core-free-icons";

interface PrivateKeySectionProps {
    isEncryptionKeyProvided: boolean;
    privateKeyPEM: string | null;
    privateKeyLoading: boolean;
    privateKeyError: string | null;
    onUnlockClick: () => void;
    onDownload: () => void;
}

export function PrivateKeySection({
    isEncryptionKeyProvided,
    privateKeyPEM,
    privateKeyLoading,
    privateKeyError,
    onUnlockClick,
    onDownload,
}: PrivateKeySectionProps) {
    const [isOpen, setIsOpen] = useState(false);

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
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className="mb-6 shadow-sm border-border">
                <CardHeader>
                    <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                        <HugeiconsIcon
                            icon={Key01Icon}
                            className="w-5 h-5"
                            strokeWidth={2}
                        />
                        <div className="text-left">
                            <CardTitle>Private Key (PEM)</CardTitle>
                            <CardDescription>
                                RSA private key in PEM format
                            </CardDescription>
                        </div>
                        <HugeiconsIcon
                            icon={isOpen ? ArrowUp01Icon : ArrowDown01Icon}
                            className="w-4 h-4 ml-1 text-muted-foreground"
                            strokeWidth={2}
                        />
                    </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent>
                        {privateKeyLoading ? (
                            <LoadingSpinner text="Decrypting private key..." />
                        ) : privateKeyError ? (
                            <p className="text-sm text-destructive">
                                {privateKeyError}
                            </p>
                        ) : privateKeyPEM ? (
                            <CodeBlock
                                content={privateKeyPEM}
                                onDownload={onDownload}
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No private key available
                            </p>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
