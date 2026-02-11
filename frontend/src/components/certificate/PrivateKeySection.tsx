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

interface PrivateKeySectionProps {
    isEncryptionKeyProvided: boolean;
    privateKeyPEM: string | null;
    privateKeyLoading: boolean;
    privateKeyError: string | null;
}

export function PrivateKeySection({
    isEncryptionKeyProvided,
    privateKeyPEM,
    privateKeyLoading,
    privateKeyError,
}: PrivateKeySectionProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className="mb-6 shadow-sm border-border">
                <CardHeader>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full cursor-pointer hover:opacity-80 transition-opacity">
                        <HugeiconsIcon
                            icon={Key01Icon}
                            className="w-5 h-5"
                            strokeWidth={2}
                        />
                        <div className="text-left flex-1">
                            <CardTitle>Private Key (PEM)</CardTitle>
                            <CardDescription>
                                RSA private key in PEM format
                            </CardDescription>
                        </div>
                        <HugeiconsIcon
                            icon={isOpen ? ArrowUp01Icon : ArrowDown01Icon}
                            className="w-4 h-4 text-muted-foreground shrink-0"
                            strokeWidth={2}
                        />
                    </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent>
                        {!isEncryptionKeyProvided ? (
                            <p className="text-sm text-warning">
                                Private key content can only be retrieved when the encryption key is provided.
                            </p>
                        ) : privateKeyLoading ? (
                            <LoadingSpinner text="Decrypting private key..." />
                        ) : privateKeyError ? (
                            <p className="text-sm text-destructive">
                                {privateKeyError}
                            </p>
                        ) : privateKeyPEM ? (
                            <CodeBlock
                                content={privateKeyPEM}
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
