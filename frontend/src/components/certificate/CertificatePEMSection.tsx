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
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Certificate02Icon,
    ArrowDown01Icon,
    ArrowUp01Icon,
} from "@hugeicons/core-free-icons";

interface CertificatePEMSectionProps {
    hostname: string;
    certificatePEM: string;
}

export function CertificatePEMSection({
    hostname,
    certificatePEM,
}: CertificatePEMSectionProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className="mb-6 shadow-sm border-border">
                <CardHeader>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full cursor-pointer hover:opacity-80 transition-opacity">
                        <HugeiconsIcon
                            icon={Certificate02Icon}
                            className="w-5 h-5"
                            strokeWidth={2}
                        />
                        <div className="text-left flex-1">
                            <CardTitle>Certificate (PEM)</CardTitle>
                            <CardDescription>
                                X.509 certificate in PEM format
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
                        <CodeBlock
                            content={certificatePEM}
                            downloadFilename={`${hostname}.crt`}
                        />
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
