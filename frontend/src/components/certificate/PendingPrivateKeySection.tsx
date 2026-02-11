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
import { CodeBlock } from "@/components/ui/code-block";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
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
    downloadFilename?: string;
}

export function PendingPrivateKeySection({
    hasPendingCSR,
    isEncryptionKeyProvided,
    pendingPrivateKeyPEM,
    pendingPrivateKeyLoading,
    pendingPrivateKeyError,
    downloadFilename,
}: PendingPrivateKeySectionProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!hasPendingCSR || !isEncryptionKeyProvided) {
        return null;
    }

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className="mb-6 shadow-sm border-info/30 bg-info/10">
                <CardHeader>
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
                            <CodeBlock
                                content={pendingPrivateKeyPEM}
                                downloadFilename={downloadFilename}
                            />
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
