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
import { pendingCardStyles } from "@/lib/theme";

interface PendingPrivateKeySectionProps {
    hasPendingCSR: boolean;
    isUnlocked: boolean;
    pendingPrivateKeyPEM: string | null;
    pendingPrivateKeyLoading: boolean;
    pendingPrivateKeyError: string | null;
}

export function PendingPrivateKeySection({
    hasPendingCSR,
    isUnlocked,
    pendingPrivateKeyPEM,
    pendingPrivateKeyLoading,
    pendingPrivateKeyError,
}: PendingPrivateKeySectionProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!hasPendingCSR) {
        return null;
    }

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className={`mb-6 shadow-sm ${pendingCardStyles.card}`}>
                <CardHeader>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full cursor-pointer hover:opacity-80 transition-opacity">
                        <HugeiconsIcon
                            icon={Key01Icon}
                            className={`w-5 h-5 ${pendingCardStyles.icon}`}
                            strokeWidth={2}
                        />
                        <div className="text-left flex-1">
                            <CardTitle className={pendingCardStyles.title}>
                                Pending Private Key (PEM)
                            </CardTitle>
                            <CardDescription className={pendingCardStyles.description}>
                                RSA private key associated with the pending CSR
                            </CardDescription>
                        </div>
                        <HugeiconsIcon
                            icon={isOpen ? ArrowUp01Icon : ArrowDown01Icon}
                            className={`w-4 h-4 ${pendingCardStyles.iconMuted} shrink-0`}
                            strokeWidth={2}
                        />
                    </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent>
                        {!isUnlocked ? (
                            <p className="text-sm text-warning">
                                Private key content can only be retrieved when the encryption key is provided.
                            </p>
                        ) : pendingPrivateKeyLoading ? (
                            <LoadingSpinner text="Decrypting pending private key..." />
                        ) : pendingPrivateKeyError ? (
                            <p className="text-sm text-destructive">
                                {pendingPrivateKeyError}
                            </p>
                        ) : pendingPrivateKeyPEM ? (
                            <CodeBlock
                                content={pendingPrivateKeyPEM}
                            />
                        ) : (
                            <p className={`text-sm ${pendingCardStyles.text}`}>
                                No pending private key available
                            </p>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
