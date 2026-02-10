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
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Download04Icon,
    Key01Icon,
    ArrowDown01Icon,
    ArrowUp01Icon,
} from "@hugeicons/core-free-icons";

interface PendingPrivateKeySectionProps {
    hasPendingCSR: boolean;
    isEncryptionKeyProvided: boolean;
    pendingPrivateKeyPEM: string | null;
    pendingPrivateKeyLoading: boolean;
    pendingPrivateKeyError: string | null;
    onDownloadClick: () => void;
}

export function PendingPrivateKeySection({
    hasPendingCSR,
    isEncryptionKeyProvided,
    pendingPrivateKeyPEM,
    pendingPrivateKeyLoading,
    pendingPrivateKeyError,
    onDownloadClick,
}: PendingPrivateKeySectionProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!hasPendingCSR || !isEncryptionKeyProvided) {
        return null;
    }

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className="mb-6 shadow-sm border-info/30 bg-info/10">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                            <HugeiconsIcon
                                icon={Key01Icon}
                                className="w-5 h-5 text-info dark:text-chart-2"
                                strokeWidth={2}
                            />
                            <div className="text-left">
                                <CardTitle className="text-info dark:text-chart-2">
                                    Pending Private Key (PEM)
                                </CardTitle>
                                <CardDescription className="text-info/80 dark:text-chart-2/80">
                                    RSA private key associated with the pending CSR
                                </CardDescription>
                            </div>
                            <HugeiconsIcon
                                icon={isOpen ? ArrowUp01Icon : ArrowDown01Icon}
                                className="w-4 h-4 ml-1 text-info/60 dark:text-chart-2/60"
                                strokeWidth={2}
                            />
                        </CollapsibleTrigger>
                        {pendingPrivateKeyPEM && (
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
                <CollapsibleContent>
                    <CardContent>
                        {pendingPrivateKeyLoading ? (
                            <LoadingSpinner text="Decrypting pending private key..." />
                        ) : pendingPrivateKeyError ? (
                            <p className="text-sm text-destructive">
                                {pendingPrivateKeyError}
                            </p>
                        ) : pendingPrivateKeyPEM ? (
                            <CodeBlock content={pendingPrivateKeyPEM} />
                        ) : (
                            <p className="text-sm text-info/80 dark:text-chart-2/80">
                                No pending private key available
                            </p>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
