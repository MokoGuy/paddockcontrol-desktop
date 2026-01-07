import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { Header } from "@/components/layout/Header";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/certificate/StatusBadge";
import { formatDateTime } from "@/lib/theme";
import { Certificate } from "@/types";

export function CertificateDetail() {
    const { hostname } = useParams<{ hostname: string }>();
    const navigate = useNavigate();
    const {
        getCertificate,
        deleteCertificate,
        uploadCertificate,
        downloadPrivateKey,
        isLoading: certLoading,
        error: certError,
    } = useCertificates();
    const { copyToClipboard, isLoading: backupLoading } = useBackup();
    const { isEncryptionKeyProvided } = useAppStore();

    const [certificate, setCertificate] = useState<Certificate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirming, setDeleteConfirming] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Upload certificate dialog state
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [uploadCertPEM, setUploadCertPEM] = useState("");
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

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

    const handleDelete = async () => {
        if (!hostname) return;
        try {
            await deleteCertificate(hostname);
            navigate("/dashboard", { replace: true });
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to delete certificate",
            );
        }
    };

    const handleCopy = async (text: string, field: string) => {
        try {
            await copyToClipboard(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error("Copy error:", err);
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

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
                <Header />
                <div className="flex items-center justify-center min-h-[60vh]">
                    <LoadingSpinner text="Loading certificate..." />
                </div>
            </div>
        );
    }

    if (error || !certificate) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
                <Header />
                <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900">
                        <CardContent className="pt-6">
                            <p className="text-sm text-red-800 dark:text-red-200">
                                {error || "Certificate not found"}
                            </p>
                            <Button
                                onClick={() => navigate("/dashboard")}
                                className="mt-4"
                            >
                                Back to Dashboard
                            </Button>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <Header />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {certificate.hostname}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Certificate details and operations
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => navigate("/dashboard")}
                    >
                        ← Back
                    </Button>
                </div>

                {/* Error Message */}
                {certError && (
                    <Card className="mb-6 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900">
                        <CardContent className="pt-6">
                            <p className="text-sm text-red-800 dark:text-red-200">
                                {certError}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Status and Quick Info */}
                <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Status</CardTitle>
                                <CardDescription>
                                    Current certificate status
                                </CardDescription>
                            </div>
                            <StatusBadge
                                status={certificate.status}
                                daysUntilExpiration={
                                    certificate.days_until_expiration
                                }
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Created
                                </p>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {formatDateTime(certificate.created_at)}
                                </p>
                            </div>
                            {certificate.expires_at && (
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Expires
                                    </p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {formatDateTime(certificate.expires_at)}
                                    </p>
                                </div>
                            )}
                            {certificate.key_size && (
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Key Size
                                    </p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {certificate.key_size} bits
                                    </p>
                                </div>
                            )}
                            {certificate.days_until_expiration !==
                                undefined && (
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Days Until Expiration
                                    </p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {certificate.days_until_expiration} days
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Subject Information */}
                <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
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
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Organization
                                    </p>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                        {certificate.organization}
                                    </p>
                                </div>
                            )}
                            {certificate.organizational_unit && (
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Organizational Unit
                                    </p>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                        {certificate.organizational_unit}
                                    </p>
                                </div>
                            )}
                            {certificate.city && (
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        City
                                    </p>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                        {certificate.city}
                                    </p>
                                </div>
                            )}
                            {certificate.state && (
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        State
                                    </p>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                        {certificate.state}
                                    </p>
                                </div>
                            )}
                            {certificate.country && (
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Country
                                    </p>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                        {certificate.country}
                                    </p>
                                </div>
                            )}
                        </div>

                        {certificate.sans && certificate.sans.length > 0 && (
                            <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
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

                {/* Certificate Content */}
                {certificate.certificate_pem && (
                    <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
                        <CardHeader>
                            <CardTitle>Certificate (PEM)</CardTitle>
                            <CardDescription>
                                X.509 certificate in PEM format
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-48 border border-gray-700">
                                    {certificate.certificate_pem}
                                </pre>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="absolute top-2 right-2"
                                    onClick={() =>
                                        handleCopy(
                                            certificate.certificate_pem!,
                                            "cert",
                                        )
                                    }
                                >
                                    {copiedField === "cert"
                                        ? "✓ Copied"
                                        : "Copy"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Pending CSR */}
                {certificate.pending_csr && (
                    <Card className="mb-6 shadow-sm border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950">
                        <CardHeader>
                            <CardTitle className="text-yellow-900 dark:text-yellow-100">
                                Pending Certificate Signing Request
                            </CardTitle>
                            <CardDescription className="text-yellow-800 dark:text-yellow-200">
                                This CSR is awaiting a signed certificate
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-48 border border-gray-700">
                                    {certificate.pending_csr}
                                </pre>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="absolute top-2 right-2"
                                    onClick={() =>
                                        handleCopy(
                                            certificate.pending_csr!,
                                            "csr",
                                        )
                                    }
                                >
                                    {copiedField === "csr"
                                        ? "✓ Copied"
                                        : "Copy"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Notes */}
                {(certificate.note || certificate.pending_note) && (
                    <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
                        <CardHeader>
                            <CardTitle>Notes</CardTitle>
                            <CardDescription>
                                Additional information
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {certificate.note && (
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                                        Note
                                    </p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                        {certificate.note}
                                    </p>
                                </div>
                            )}
                            {certificate.pending_note && (
                                <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                                        Pending Note
                                    </p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                        {certificate.pending_note}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Actions */}
                <Card className="shadow-sm border-gray-200 dark:border-gray-800">
                    <CardHeader>
                        <CardTitle>Actions</CardTitle>
                        <CardDescription>
                            Manage this certificate
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {certificate.certificate_pem && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        // Download certificate - handled by backend Wails method
                                        const link =
                                            document.createElement("a");
                                        link.href =
                                            "data:text/plain;charset=utf-8," +
                                            encodeURIComponent(
                                                certificate.certificate_pem!,
                                            );
                                        link.download = `${certificate.hostname}.crt`;
                                        link.click();
                                    }}
                                >
                                    Download Certificate
                                </Button>
                            )}
                            {certificate.pending_csr && (
                                <>
                                    <Button
                                        variant="outline"
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
                                        Download CSR
                                    </Button>
                                    <Button
                                        variant="default"
                                        onClick={() => setUploadDialogOpen(true)}
                                    >
                                        Upload Signed Certificate
                                    </Button>
                                </>
                            )}
                            {/* Download Private Key - requires encryption key */}
                            <Button
                                variant="outline"
                                onClick={() =>
                                    downloadPrivateKey(certificate.hostname)
                                }
                                disabled={
                                    !isEncryptionKeyProvided ||
                                    certLoading ||
                                    backupLoading
                                }
                                title={
                                    !isEncryptionKeyProvided
                                        ? "Encryption key required"
                                        : ""
                                }
                            >
                                Download Private Key
                            </Button>
                            {!certificate.read_only && (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            navigate("/certificates/generate", {
                                                state: {
                                                    renewal:
                                                        certificate.hostname,
                                                },
                                            })
                                        }
                                        disabled={!isEncryptionKeyProvided}
                                        title={
                                            !isEncryptionKeyProvided
                                                ? "Encryption key required"
                                                : ""
                                        }
                                    >
                                        Renew Certificate
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                        onClick={() =>
                                            setDeleteConfirming(true)
                                        }
                                        disabled={certLoading || backupLoading}
                                    >
                                        Delete
                                    </Button>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>

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
                            <div className="p-3 text-sm text-red-800 bg-red-50 dark:bg-red-950 dark:text-red-200 rounded-md">
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
                            {isUploading ? "Uploading..." : "Upload Certificate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
