import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
        border: "border-l-blue-500",
        badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        label: "Leaf Certificate",
    },
    intermediate: {
        border: "border-l-yellow-500",
        badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
        label: "Intermediate CA",
    },
    root: {
        border: "border-l-green-500",
        badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
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
            className={`border-l-4 ${config.border} pl-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-r-md`}
        >
            <div className="flex items-center justify-between mb-3">
                <Badge className={config.badge}>{config.label}</Badge>
                {cert.pem && cert.cert_type !== "leaf" && (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleCopy}
                            title="Copy PEM"
                        >
                            <HugeiconsIcon
                                icon={isCopied(cert.pem) ? Tick02Icon : Copy01Icon}
                                className={`w-4 h-4 ${isCopied(cert.pem) ? "text-green-500" : ""}`}
                                strokeWidth={2}
                            />
                        </Button>
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
                    </div>
                )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Subject CN
                    </p>
                    <p className="text-gray-900 dark:text-white font-medium truncate">
                        {cert.subject_cn || "N/A"}
                    </p>
                </div>
                {cert.subject_o && (
                    <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Subject O
                        </p>
                        <p className="text-gray-900 dark:text-white truncate">
                            {cert.subject_o}
                        </p>
                    </div>
                )}
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Issuer CN
                    </p>
                    <p className="text-gray-900 dark:text-white truncate">
                        {cert.issuer_cn || "N/A"}
                    </p>
                </div>
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Valid From
                    </p>
                    <p className="text-gray-900 dark:text-white">
                        {formatDateTime(cert.not_before_timestamp)}
                    </p>
                </div>
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Valid Until
                    </p>
                    <p className="text-gray-900 dark:text-white">
                        {formatDateTime(cert.not_after_timestamp)}
                    </p>
                </div>
                <div className="col-span-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Serial Number
                    </p>
                    <p className="text-gray-900 dark:text-white font-mono text-xs truncate">
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

    // Don't render if loading
    if (isLoading) {
        return (
            <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
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
            <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
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
                    <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
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
        <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
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
                    </div>
                    {onDownloadChain && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onDownloadChain}
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
        </Card>
    );
}
