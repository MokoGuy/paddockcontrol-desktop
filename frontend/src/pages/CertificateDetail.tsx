import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useCertificates } from "@/hooks/useCertificates";
import { useBackup } from "@/hooks/useBackup";
import { useAppStore } from "@/stores/useAppStore";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { FileDropTextarea } from "@/components/shared/FileDropTextarea";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EncryptionKeyDialog } from "@/components/shared/EncryptionKeyDialog";
import { StatusBadge } from "@/components/certificate/StatusBadge";
import { ReadOnlyBadge } from "@/components/certificate/ReadOnlyBadge";
import { CertificatePath } from "@/components/certificate/CertificatePath";
import { CodeBlock } from "@/components/ui/code-block";
import { AnimatedSwitch } from "@/components/ui/animated-switch";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/theme";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Download04Icon,
    RefreshIcon,
    Delete02Icon,
    Key01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@/lib/api";
import { Certificate, ChainCertificateInfo } from "@/types";

export function CertificateDetail() {
    const { hostname } = useParams<{ hostname: string }>();
    const navigate = useNavigate();
    const {
        getCertificate,
        deleteCertificate,
        uploadCertificate,
        downloadPrivateKey,
        setCertificateReadOnly,
        isLoading: certLoading,
        error: certError,
    } = useCertificates();
    const { isLoading: backupLoading } = useBackup();
    const { isEncryptionKeyProvided } = useAppStore();

    const [certificate, setCertificate] = useState<Certificate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirming, setDeleteConfirming] = useState(false);

    // Upload certificate dialog state
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [uploadCertPEM, setUploadCertPEM] = useState("");
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Certificate chain state
    const [chain, setChain] = useState<ChainCertificateInfo[]>([]);
    const [chainLoading, setChainLoading] = useState(false);
    const [chainError, setChainError] = useState<string | null>(null);

    // Private key state
    const [privateKeyPEM, setPrivateKeyPEM] = useState<string | null>(null);
    const [privateKeyLoading, setPrivateKeyLoading] = useState(false);
    const [privateKeyError, setPrivateKeyError] = useState<string | null>(null);

    // Encryption key dialog state
    const [showKeyDialog, setShowKeyDialog] = useState(false);

    // Read-only toggle state
    const [isTogglingReadOnly, setIsTogglingReadOnly] = useState(false);

    useEffect(() => {
        loadCertificate();
    }, [hostname]);

    const loadCertificate = async () => {
        if (!hostname) return;
        setIsLoading(true);
        setError(null);
        try {
            const cert = await getCertificate(hostname);
            if (cert) {
                setCertificate(cert);
            } else {
                setError("Certificate not found");
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load certificate",
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Load certificate chain when we have a certificate with PEM
    const loadCertificateChain = async () => {
        if (!hostname || !certificate?.certificate_pem) return;

        setChainLoading(true);
        setChainError(null);
        try {
            const chainData = await api.getCertificateChain(hostname);
            setChain(chainData || []);
        } catch (err) {
            setChainError(
                err instanceof Error
                    ? err.message
                    : "Failed to load certificate chain",
            );
        } finally {
            setChainLoading(false);
        }
    };

    // Trigger chain loading when certificate PEM is available
    useEffect(() => {
        if (certificate?.certificate_pem) {
            loadCertificateChain();
        }
    }, [certificate?.certificate_pem, hostname]);

    // Load private key when encryption key is available
    const loadPrivateKey = async () => {
        if (!hostname || !isEncryptionKeyProvided) return;

        setPrivateKeyLoading(true);
        setPrivateKeyError(null);
        try {
            const pem = await api.getPrivateKeyPEM(hostname);
            setPrivateKeyPEM(pem);
        } catch (err) {
            // Wails throws Go errors as strings, not Error objects
            const message =
                typeof err === "string"
                    ? err
                    : err instanceof Error
                      ? err.message
                      : "Failed to load private key";
            setPrivateKeyError(message);
        } finally {
            setPrivateKeyLoading(false);
        }
    };

    // Trigger private key loading when certificate and encryption key are available
    useEffect(() => {
        if (certificate && isEncryptionKeyProvided) {
            loadPrivateKey();
        }
    }, [certificate, isEncryptionKeyProvided, hostname]);

    const handleDelete = async () => {
        if (!hostname) return;
        try {
            await deleteCertificate(hostname);
            navigate("/", { replace: true });
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to delete certificate",
            );
        }
    };

    const handleUploadCertificate = async () => {
        if (!hostname || !uploadCertPEM.trim()) return;

        // Basic PEM validation
        if (!uploadCertPEM.includes("-----BEGIN CERTIFICATE-----")) {
            setUploadError("Invalid certificate format. Must be PEM encoded.");
            return;
        }

        setIsUploading(true);
        setUploadError(null);

        try {
            await uploadCertificate(hostname, uploadCertPEM.trim());
            setUploadDialogOpen(false);
            setUploadCertPEM("");
            await loadCertificate(); // Reload to show updated status
        } catch (err) {
            setUploadError(
                err instanceof Error ? err.message : "Upload failed",
            );
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownloadChain = async () => {
        if (!hostname) return;
        try {
            await api.saveChainToFile(hostname);
        } catch (err) {
            console.error("Download chain failed:", err);
        }
    };

    const handleToggleReadOnly = async (checked: boolean) => {
        if (!hostname || !certificate) return;
        setIsTogglingReadOnly(true);
        setCertificate({ ...certificate, read_only: checked });
        try {
            await setCertificateReadOnly(hostname, checked);
        } catch (err) {
            setCertificate({ ...certificate, read_only: !checked });
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to update read-only status",
            );
        } finally {
            setIsTogglingReadOnly(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <LoadingSpinner text="Loading certificate..." />
            </div>
        );
    }

    if (error || !certificate) {
        return (
            <Card className="bg-destructive/10 border-destructive/30">
                <CardContent>
                    <p className="text-sm text-destructive">
                        {error || "Certificate not found"}
                    </p>
                    <Button
                        onClick={() => navigate("/")}
                        variant="outline"
                        className="mt-4"
                    >
                        Back to Dashboard
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">
                        {certificate.hostname}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Certificate details and operations
                    </p>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 mr-4 pr-4 border-r border-border">
                        <AnimatedSwitch
                            id="read-only-switch"
                            checked={certificate.read_only}
                            onCheckedChange={handleToggleReadOnly}
                            disabled={isTogglingReadOnly}
                        />
                        <Label
                            htmlFor="read-only-switch"
                            className="text-sm text-muted-foreground cursor-pointer"
                        >
                            Read-only
                        </Label>
                    </div>
                    <motion.div
                        animate={{ opacity: certificate.read_only ? 0.5 : 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                navigate("/certificates/generate", {
                                    state: {
                                        renewal: certificate.hostname,
                                    },
                                })
                            }
                            disabled={!isEncryptionKeyProvided || certificate.read_only}
                            title={
                                certificate.read_only
                                    ? "Certificate is read-only"
                                    : !isEncryptionKeyProvided
                                      ? "Encryption key required"
                                      : ""
                            }
                        >
                            <HugeiconsIcon
                                icon={RefreshIcon}
                                className="w-4 h-4 mr-1"
                                strokeWidth={2}
                            />
                            Renew
                        </Button>
                    </motion.div>
                    <motion.div
                        animate={{ opacity: certificate.read_only ? 0.5 : 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 disabled:text-destructive/50"
                            onClick={() => setDeleteConfirming(true)}
                            disabled={certLoading || backupLoading || certificate.read_only}
                            title={certificate.read_only ? "Certificate is read-only" : ""}
                        >
                            <HugeiconsIcon
                                icon={Delete02Icon}
                                className="w-4 h-4 mr-1"
                                strokeWidth={2}
                            />
                            Delete
                        </Button>
                    </motion.div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/")}
                    >
                        ← Back
                    </Button>
                </div>
            </div>

            {/* Error Message */}
            {certError && (
                <Card className="mb-6 bg-destructive/10 border-destructive/30">
                    <CardContent>
                        <p className="text-sm text-destructive">
                            {certError}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Status and Basic Info */}
            <Card className="mb-6 shadow-sm border-border">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Status</CardTitle>
                            <CardDescription>
                                Current certificate status
                            </CardDescription>
                        </div>
                        <motion.div className="flex items-center gap-2" layout>
                            <motion.div layout transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
                                <StatusBadge
                                    status={certificate.status}
                                    daysUntilExpiration={
                                        certificate.days_until_expiration
                                    }
                                />
                            </motion.div>
                            <AnimatePresence mode="popLayout">
                                {certificate.read_only && (
                                    <motion.div
                                        key="read-only-badge"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{
                                            type: 'spring',
                                            stiffness: 500,
                                            damping: 30,
                                        }}
                                    >
                                        <ReadOnlyBadge />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                Created
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                                {formatDateTime(certificate.created_at)}
                            </p>
                        </div>
                        {certificate.expires_at && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase">
                                    Expires
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                    {formatDateTime(certificate.expires_at)}
                                </p>
                            </div>
                        )}
                        {certificate.key_size && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase">
                                    Key Size
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                    {certificate.key_size} bits
                                </p>
                            </div>
                        )}
                        {certificate.days_until_expiration !== undefined && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase">
                                    Days Until Expiration
                                </p>
                                <p className="text-sm font-semibold text-foreground">
                                    {certificate.days_until_expiration} days
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Subject Information */}
            <Card className="mb-6 shadow-sm border-border">
                <CardHeader>
                    <CardTitle>Subject Information</CardTitle>
                    <CardDescription>
                        Certificate subject details
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {certificate.organization && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase">
                                    Organization
                                </p>
                                <p className="text-sm text-foreground">
                                    {certificate.organization}
                                </p>
                            </div>
                        )}
                        {certificate.organizational_unit && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase">
                                    Organizational Unit
                                </p>
                                <p className="text-sm text-foreground">
                                    {certificate.organizational_unit}
                                </p>
                            </div>
                        )}
                        {certificate.city && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase">
                                    City
                                </p>
                                <p className="text-sm text-foreground">
                                    {certificate.city}
                                </p>
                            </div>
                        )}
                        {certificate.state && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase">
                                    State
                                </p>
                                <p className="text-sm text-foreground">
                                    {certificate.state}
                                </p>
                            </div>
                        )}
                        {certificate.country && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase">
                                    Country
                                </p>
                                <p className="text-sm text-foreground">
                                    {certificate.country}
                                </p>
                            </div>
                        )}
                    </div>

                    {certificate.sans && certificate.sans.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                                Subject Alternative Names
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {certificate.sans.map((san) => (
                                    <Badge key={san} variant="secondary">
                                        {san}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pending CSR */}
            {certificate.pending_csr && (
                <Card className="mb-6 shadow-sm border-warning/30 bg-warning-muted">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-warning-foreground">
                                    Pending Certificate Signing Request
                                </CardTitle>
                                <CardDescription className="text-warning-foreground/80">
                                    This CSR is awaiting a signed certificate
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-warning/50 text-warning-foreground hover:bg-warning/20"
                                    onClick={() => {
                                        const link =
                                            document.createElement("a");
                                        link.href =
                                            "data:text/plain;charset=utf-8," +
                                            encodeURIComponent(
                                                certificate.pending_csr!,
                                            );
                                        link.download = `${certificate.hostname}.csr`;
                                        link.click();
                                    }}
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
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => setUploadDialogOpen(true)}
                                        disabled={certificate.read_only}
                                        title={certificate.read_only ? "Certificate is read-only" : ""}
                                    >
                                        Upload Signed Certificate
                                    </Button>
                                </motion.div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <CodeBlock content={certificate.pending_csr} />
                    </CardContent>
                </Card>
            )}

            {/* Certificate Path - only for active certificates */}
            {certificate.certificate_pem && (
                <CertificatePath
                    chain={chain}
                    isLoading={chainLoading}
                    error={chainError}
                    onDownloadChain={handleDownloadChain}
                    hostname={certificate.hostname}
                />
            )}

            {/* Certificate Content */}
            {certificate.certificate_pem && (
                <Card className="mb-6 shadow-sm border-border">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Certificate (PEM)</CardTitle>
                                <CardDescription>
                                    X.509 certificate in PEM format
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const link = document.createElement("a");
                                    link.href =
                                        "data:text/plain;charset=utf-8," +
                                        encodeURIComponent(
                                            certificate.certificate_pem!,
                                        );
                                    link.download = `${certificate.hostname}.crt`;
                                    link.click();
                                }}
                            >
                                <HugeiconsIcon
                                    icon={Download04Icon}
                                    className="w-4 h-4 mr-1"
                                    strokeWidth={2}
                                />
                                Download
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <CodeBlock content={certificate.certificate_pem} />
                    </CardContent>
                </Card>
            )}

            {/* Private Key (PEM) */}
            <Card
                className={`mb-6 shadow-sm ${!isEncryptionKeyProvided ? "bg-warning-muted border-warning/30" : "border-border"}`}
            >
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <HugeiconsIcon
                                icon={Key01Icon}
                                className={`w-5 h-5 ${!isEncryptionKeyProvided ? "text-warning-foreground" : ""}`}
                                strokeWidth={2}
                            />
                            <div>
                                <CardTitle
                                    className={
                                        !isEncryptionKeyProvided
                                            ? "text-warning-foreground"
                                            : ""
                                    }
                                >
                                    Private Key (PEM)
                                </CardTitle>
                                <CardDescription
                                    className={
                                        !isEncryptionKeyProvided
                                            ? "text-warning-foreground/80"
                                            : ""
                                    }
                                >
                                    {!isEncryptionKeyProvided
                                        ? "Provide your encryption key to view and download the private key"
                                        : "RSA private key in PEM format"}
                                </CardDescription>
                            </div>
                        </div>
                        {!isEncryptionKeyProvided ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-warning/50 text-warning-foreground hover:bg-warning/20"
                                onClick={() => setShowKeyDialog(true)}
                            >
                                Unlock
                            </Button>
                        ) : privateKeyPEM ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    downloadPrivateKey(certificate.hostname)
                                }
                            >
                                <HugeiconsIcon
                                    icon={Download04Icon}
                                    className="w-4 h-4 mr-1"
                                    strokeWidth={2}
                                />
                                Download
                            </Button>
                        ) : null}
                    </div>
                </CardHeader>
                {isEncryptionKeyProvided && (
                    <CardContent>
                        {privateKeyLoading ? (
                            <LoadingSpinner text="Decrypting private key..." />
                        ) : privateKeyError ? (
                            <p className="text-sm text-destructive">
                                {privateKeyError}
                            </p>
                        ) : privateKeyPEM ? (
                            <CodeBlock content={privateKeyPEM} />
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No private key available
                            </p>
                        )}
                    </CardContent>
                )}
            </Card>

            {/* Notes */}
            {(certificate.note || certificate.pending_note) && (
                <Card className="mb-6 shadow-sm border-border">
                    <CardHeader>
                        <CardTitle>Notes</CardTitle>
                        <CardDescription>
                            Additional information
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {certificate.note && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                                    Note
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {certificate.note}
                                </p>
                            </div>
                        )}
                        {certificate.pending_note && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                                    Pending Note
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {certificate.pending_note}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={deleteConfirming}
                title="Delete Certificate"
                description={`Are you sure you want to delete ${certificate.hostname}? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                isDestructive={true}
                isLoading={certLoading}
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirming(false)}
            />

            {/* Upload Certificate Dialog */}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Upload Signed Certificate</DialogTitle>
                        <DialogDescription>
                            Paste the signed certificate or drag and drop a file
                            (.crt, .pem).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {uploadError && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                                {uploadError}
                            </div>
                        )}
                        <FileDropTextarea
                            value={uploadCertPEM}
                            onChange={setUploadCertPEM}
                            onError={setUploadError}
                            placeholder={`-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----`}
                            className="font-mono text-xs h-64"
                            acceptedExtensions={[".crt", ".pem", ".cer"]}
                            dropLabel="Drop certificate file here"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setUploadDialogOpen(false);
                                setUploadCertPEM("");
                                setUploadError(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUploadCertificate}
                            disabled={isUploading || !uploadCertPEM.trim()}
                        >
                            {isUploading
                                ? "Uploading..."
                                : "Upload Certificate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Encryption Key Dialog */}
            <EncryptionKeyDialog
                open={showKeyDialog}
                onClose={() => setShowKeyDialog(false)}
            />
        </>
    );
}
