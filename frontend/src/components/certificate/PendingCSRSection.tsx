import { motion } from "motion/react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import type { Certificate } from "@/types";

interface PendingCSRSectionProps {
    certificate: Certificate;
    isEncryptionKeyProvided: boolean;
    onUploadClick: () => void;
    onCancelRenewal: () => void;
    cancelRenewalConfirming: boolean;
    setCancelRenewalConfirming: (value: boolean) => void;
    isLoading?: boolean;
}

export function PendingCSRSection({
    certificate,
    isEncryptionKeyProvided,
    onUploadClick,
    onCancelRenewal,
    cancelRenewalConfirming,
    setCancelRenewalConfirming,
    isLoading,
}: PendingCSRSectionProps) {
    if (!certificate.pending_csr) {
        return null;
    }

    const handleDownload = () => {
        const link = document.createElement("a");
        link.href =
            "data:text/plain;charset=utf-8," +
            encodeURIComponent(certificate.pending_csr!);
        link.download = `${certificate.hostname}.csr`;
        link.click();
    };

    return (
        <>
            <Card className="mb-6 shadow-sm border-info/30 bg-info/10">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-info dark:text-chart-2">
                                Pending Certificate Signing Request
                            </CardTitle>
                            <CardDescription className="text-info/80 dark:text-chart-2/80">
                                This CSR is awaiting a signed certificate
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownload}
                            >
                                <HugeiconsIcon
                                    icon={Download04Icon}
                                    className="w-4 h-4 mr-1"
                                    strokeWidth={2}
                                />
                                Download
                            </Button>
                            <motion.div
                                animate={{ opacity: certificate.read_only ? 0.5 : 1 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="inline-flex">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={onUploadClick}
                                                disabled={certificate.read_only || !isEncryptionKeyProvided}
                                            >
                                                Upload Signed Certificate
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    {(certificate.read_only || !isEncryptionKeyProvided) && (
                                        <TooltipContent>
                                            {certificate.read_only
                                                ? "Certificate is read-only"
                                                : "Encryption key required"}
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </motion.div>
                            <motion.div
                                animate={{ opacity: certificate.read_only ? 0.5 : 1 }}
                                transition={{ duration: 0.2 }}
                            >
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
                                                Cancel Renewal
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    {certificate.read_only && (
                                        <TooltipContent>
                                            Certificate is read-only
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </motion.div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <CodeBlock content={certificate.pending_csr} />
                </CardContent>
            </Card>

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
