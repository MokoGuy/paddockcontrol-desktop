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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ChainCertificateInfo } from "@/types";
import { formatDateTime } from "@/lib/theme";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Link04Icon,
    Alert02Icon,
    Download04Icon,
    Copy01Icon,
    Tick02Icon,
    ArrowDown01Icon,
    ArrowUp01Icon,
} from "@hugeicons/core-free-icons";

interface CertificatePathProps {
    chain: ChainCertificateInfo[];
    isLoading: boolean;
    error: string | null;
    onDownloadChain?: () => void;
    hostname?: string;
}

// Color and label mappings for certificate types
const typeConfig = {
    leaf: {
        border: "border-l-info",
        badge: "bg-info/15 text-info dark:bg-info/25",
        label: "Leaf Certificate",
    },
    intermediate: {
        border: "border-l-warning",
        badge: "bg-warning/15 text-warning dark:bg-warning/25",
        label: "Intermediate CA",
    },
    root: {
        border: "border-l-success",
        badge: "bg-success/15 text-success dark:bg-success/25",
        label: "Root CA",
    },
} as const;

interface ChainCertificateCardProps {
    cert: ChainCertificateInfo;
    hostname?: string;
    onCopy: (text: string) => Promise<boolean>;
    isCopied: (text: string) => boolean;
}

function ChainCertificateCard({
    cert,
    hostname,
    onCopy,
    isCopied,
}: ChainCertificateCardProps) {
    const config =
        typeConfig[cert.cert_type as keyof typeof typeConfig] ||
        typeConfig.leaf;

    const getFilename = () => {
        const base = hostname || "certificate";
        if (cert.cert_type === "intermediate" && cert.depth > 1) {
            return `${base}-intermediate-${cert.depth}.crt`;
        }
        return `${base}-${cert.cert_type}.crt`;
    };

    const handleDownload = () => {
        if (!cert.pem) return;
        const link = document.createElement("a");
        link.href =
            "data:text/plain;charset=utf-8," + encodeURIComponent(cert.pem);
        link.download = getFilename();
        link.click();
    };

    const handleCopy = () => {
        if (cert.pem) {
            onCopy(cert.pem);
        }
    };

    return (
        <div
            className={`border-l-4 ${config.border} pl-4 py-3 bg-muted rounded-r-md`}
        >
            <div className="flex items-center justify-between mb-3">
                <Badge className={config.badge}>{config.label}</Badge>
                {cert.pem && cert.cert_type !== "leaf" && (
                    <div className="flex items-center gap-1 mr-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleDownload}
                            title="Download"
                        >
                            <HugeiconsIcon
                                icon={Download04Icon}
                                className="w-4 h-4"
                                strokeWidth={2}
                            />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleCopy}
                            title="Copy PEM"
                        >
                            <HugeiconsIcon
                                icon={
                                    isCopied(cert.pem) ? Tick02Icon : Copy01Icon
                                }
                                className={`w-4 h-4 ${isCopied(cert.pem) ? "text-success" : ""}`}
                                strokeWidth={2}
                            />
                        </Button>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Subject CN
                    </p>
                    <p className="text-foreground font-medium truncate">
                        {cert.subject_cn || "N/A"}
                    </p>
                </div>
                {cert.subject_o && (
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Subject O
                        </p>
                        <p className="text-foreground truncate">
                            {cert.subject_o}
                        </p>
                    </div>
                )}
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Issuer CN
                    </p>
                    <p className="text-foreground truncate">
                        {cert.issuer_cn || "N/A"}
                    </p>
                </div>
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Valid From
                    </p>
                    <p className="text-foreground">
                        {formatDateTime(cert.not_before_timestamp)}
                    </p>
                </div>
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Valid Until
                    </p>
                    <p className="text-foreground">
                        {formatDateTime(cert.not_after_timestamp)}
                    </p>
                </div>
                <div className="col-span-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Serial Number
                    </p>
                    <p className="text-foreground font-mono text-xs truncate">
                        {cert.serial_number}
                    </p>
                </div>
            </div>
        </div>
    );
}

export function CertificatePath({
    chain,
    isLoading,
    error,
    onDownloadChain,
    hostname,
}: CertificatePathProps) {
    const { copy, isCopied } = useCopyToClipboard();
    const [isOpen, setIsOpen] = useState(false);

    // Don't render if loading
    if (isLoading) {
        return (
            <Card className="mb-6 shadow-sm border-border">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <HugeiconsIcon
                            icon={Link04Icon}
                            className="w-5 h-5"
                            strokeWidth={2}
                        />
                        <CardTitle>Certificate Path</CardTitle>
                    </div>
                    <CardDescription>
                        Certificate chain from leaf to root CA
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <LoadingSpinner text="Loading certificate chain..." />
                </CardContent>
            </Card>
        );
    }

    // Show error state
    if (error) {
        return (
            <Card className="mb-6 shadow-sm border-border">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <HugeiconsIcon
                            icon={Link04Icon}
                            className="w-5 h-5"
                            strokeWidth={2}
                        />
                        <CardTitle>Certificate Path</CardTitle>
                    </div>
                    <CardDescription>
                        Certificate chain from leaf to root CA
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 text-warning">
                        <HugeiconsIcon
                            icon={Alert02Icon}
                            className="w-4 h-4"
                            strokeWidth={2}
                        />
                        <p className="text-sm">
                            Unable to fetch complete certificate chain: {error}
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Don't render section for pending certs (empty chain)
    if (chain.length === 0) {
        return null;
    }

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className="mb-6 shadow-sm border-border">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity flex-1">
                            <HugeiconsIcon
                                icon={Link04Icon}
                                className="w-5 h-5"
                                strokeWidth={2}
                            />
                            <div className="text-left flex-1">
                                <CardTitle>Certificate Path</CardTitle>
                                <CardDescription>
                                    Certificate chain from leaf to root CA
                                </CardDescription>
                            </div>
                            <HugeiconsIcon
                                icon={isOpen ? ArrowUp01Icon : ArrowDown01Icon}
                                className="w-4 h-4 text-muted-foreground shrink-0"
                                strokeWidth={2}
                            />
                        </CollapsibleTrigger>
                        {onDownloadChain && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onDownloadChain}
                                className="ml-4 shrink-0"
                            >
                                <HugeiconsIcon
                                    icon={Download04Icon}
                                    className="w-4 h-4 mr-1"
                                    strokeWidth={2}
                                />
                                Download Chain
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent>
                        <div className="space-y-3">
                            {chain.map((cert, index) => (
                                <ChainCertificateCard
                                    key={`${cert.serial_number}-${index}`}
                                    cert={cert}
                                    hostname={hostname}
                                    onCopy={copy}
                                    isCopied={isCopied}
                                />
                            ))}
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
