import { useState } from "react";
import { ReadOnlyFade } from "@/components/shared/ReadOnlyFade";
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
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { AdminGatedButton } from "@/components/shared/AdminGatedButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Cancel01Icon,
    Certificate02Icon,
    ArrowDown01Icon,
    ArrowUp01Icon,
} from "@hugeicons/core-free-icons";
import type { Certificate } from "@/types";
import { pendingCardStyles } from "@/lib/theme";

interface PendingCSRSectionProps {
    certificate: Certificate;
    onUploadClick: () => void;
    onCancelRenewal: () => void;
    cancelRenewalConfirming: boolean;
    setCancelRenewalConfirming: (value: boolean) => void;
    isLoading?: boolean;
}

export function PendingCSRSection({
    certificate,
    onUploadClick,
    onCancelRenewal,
    cancelRenewalConfirming,
    setCancelRenewalConfirming,
    isLoading,
}: PendingCSRSectionProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!certificate.pending_csr) {
        return null;
    }

    return (
        <>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <Card className={`mb-6 shadow-sm ${pendingCardStyles.card}`}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity flex-1">
                                <HugeiconsIcon
                                    icon={Certificate02Icon}
                                    className={`w-5 h-5 ${pendingCardStyles.icon}`}
                                    strokeWidth={2}
                                />
                                <div className="text-left flex-1">
                                    <CardTitle className={pendingCardStyles.title}>
                                        Pending Certificate Signing Request
                                    </CardTitle>
                                    <CardDescription className={pendingCardStyles.description}>
                                        This CSR is awaiting a signed certificate
                                    </CardDescription>
                                </div>
                                <HugeiconsIcon
                                    icon={isOpen ? ArrowUp01Icon : ArrowDown01Icon}
                                    className={`w-4 h-4 ${pendingCardStyles.iconMuted} shrink-0`}
                                    strokeWidth={2}
                                />
                            </CollapsibleTrigger>
                            <div className="flex gap-2 ml-4 shrink-0">
                                <ReadOnlyFade readOnly={certificate.read_only}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="inline-flex">
                                                <AdminGatedButton
                                                    variant="default"
                                                    size="sm"
                                                    requireAdminMode={false}
                                                    requireEncryptionKey
                                                    disabled={certificate.read_only}
                                                    disabledReason={certificate.read_only ? "Certificate is read-only" : undefined}
                                                    onClick={onUploadClick}
                                                >
                                                    Upload
                                                </AdminGatedButton>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {certificate.read_only ? "Certificate is read-only" : "Upload a signed certificate for this CSR"}
                                        </TooltipContent>
                                    </Tooltip>
                                </ReadOnlyFade>
                                <ReadOnlyFade readOnly={certificate.read_only}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="inline-flex">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 disabled:text-destructive/50"
                                                    onClick={() => setCancelRenewalConfirming(true)}
                                                    disabled={certificate.read_only || isLoading}
                                                >
                                                    <HugeiconsIcon
                                                        icon={Cancel01Icon}
                                                        className="w-4 h-4 mr-1"
                                                        strokeWidth={2}
                                                    />
                                                    Cancel
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {certificate.read_only ? "Certificate is read-only" : "Cancel the pending renewal and delete the CSR"}
                                        </TooltipContent>
                                    </Tooltip>
                                </ReadOnlyFade>
                            </div>
                        </div>
                    </CardHeader>
                    <CollapsibleContent>
                        <CardContent>
                            <CodeBlock
                                content={certificate.pending_csr}
                            />
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>

            <ConfirmDialog
                open={cancelRenewalConfirming}
                title="Cancel Renewal"
                description="This will permanently delete the pending CSR and its associated private key. The active certificate will not be affected. This action cannot be undone."
                confirmText="Cancel Renewal"
                cancelText="Keep"
                isDestructive={true}
                isLoading={isLoading}
                onConfirm={onCancelRenewal}
                onCancel={() => setCancelRenewalConfirming(false)}
            />
        </>
    );
}
