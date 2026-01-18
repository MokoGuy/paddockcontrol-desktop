import { useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AnimatedSwitch } from "@/components/ui/animated-switch";
import { FileDropTextarea } from "@/components/shared/FileDropTextarea";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EncryptionKeyDialog } from "@/components/shared/EncryptionKeyDialog";
import { StatusAlert } from "@/components/shared/StatusAlert";
import { LimitedModeNotice } from "@/components/shared/LimitedModeNotice";
import { CertificatePath } from "@/components/certificate/CertificatePath";
import { CertificateStatusSection } from "@/components/certificate/CertificateStatusSection";
import { CertificateSubjectInfo } from "@/components/certificate/CertificateSubjectInfo";
import { PendingCSRSection } from "@/components/certificate/PendingCSRSection";
import { CertificatePEMSection } from "@/components/certificate/CertificatePEMSection";
import { PrivateKeySection } from "@/components/certificate/PrivateKeySection";
import { CertificateDescriptionEditor } from "@/components/certificate/CertificateDescriptionEditor";
import { useCertificateDetail } from "@/hooks/useCertificateDetail";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    RefreshIcon,
    Delete02Icon,
    AlertCircleIcon,
} from "@hugeicons/core-free-icons";

export function CertificateDetail() {
    const { hostname } = useParams<{ hostname: string }>();
    const {
        certificate,
        isLoading,
        error,
        certError,
        certLoading,
        backupLoading,
        isEncryptionKeyProvided,
        chain,
        chainLoading,
        chainError,
        privateKeyPEM,
        privateKeyLoading,
        privateKeyError,
        deleteConfirming,
        setDeleteConfirming,
        uploadDialogOpen,
        setUploadDialogOpen,
        uploadCertPEM,
        setUploadCertPEM,
        uploadError,
        setUploadError,
        isUploading,
        showKeyDialog,
        setShowKeyDialog,
        isTogglingReadOnly,
        isSavingNote,
        handleDelete,
        handleUploadCertificate,
        handleDownloadChain,
        handleToggleReadOnly,
        handleDownloadPrivateKey,
        handleSaveNote,
        closeUploadDialog,
        navigate,
    } = useCertificateDetail({ hostname });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <LoadingSpinner text="Loading certificate..." />
            </div>
        );
    }

    if (error || !certificate) {
        return (
            <div className="space-y-4">
                <StatusAlert
                    variant="destructive"
                    icon={
                        <HugeiconsIcon
                            icon={AlertCircleIcon}
                            className="size-4"
                            strokeWidth={2}
                        />
                    }
                >
                    {error || "Certificate not found"}
                </StatusAlert>
                <Button onClick={() => navigate("/")} variant="outline">
                    Back to Dashboard
                </Button>
            </div>
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
                            size="sm"
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
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="inline-flex">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            navigate("/certificates/generate", {
                                                state: certificate.pending_csr
                                                    ? { regenerate: certificate.hostname }
                                                    : { renewal: certificate.hostname },
                                            })
                                        }
                                        disabled={!isEncryptionKeyProvided || certificate.read_only}
                                    >
                                        <HugeiconsIcon
                                            icon={RefreshIcon}
                                            className="w-4 h-4 mr-1"
                                            strokeWidth={2}
                                        />
                                        {certificate.pending_csr ? "Regenerate" : "Renew"}
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
                                        onClick={() => setDeleteConfirming(true)}
                                        disabled={certLoading || backupLoading || certificate.read_only}
                                    >
                                        <HugeiconsIcon
                                            icon={Delete02Icon}
                                            className="w-4 h-4 mr-1"
                                            strokeWidth={2}
                                        />
                                        Delete
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            {certificate.read_only && (
                                <TooltipContent>Certificate is read-only</TooltipContent>
                            )}
                        </Tooltip>
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
                <StatusAlert
                    variant="destructive"
                    className="mb-6"
                    icon={
                        <HugeiconsIcon
                            icon={AlertCircleIcon}
                            className="size-4"
                            strokeWidth={2}
                        />
                    }
                >
                    {certError}
                </StatusAlert>
            )}

            {/* Limited Mode Notice */}
            {!isEncryptionKeyProvided && (
                <LimitedModeNotice
                    className="mb-6"
                    onProvideKey={() => setShowKeyDialog(true)}
                />
            )}

            {/* Description Editor */}
            <CertificateDescriptionEditor
                hostname={certificate.hostname}
                note={certificate.note || ""}
                pendingNote={certificate.pending_note}
                hasPendingCSR={!!certificate.pending_csr}
                onSave={handleSaveNote}
                isSaving={isSavingNote}
                disabled={certificate.read_only}
            />

            {/* Status and Basic Info */}
            <CertificateStatusSection certificate={certificate} />

            {/* Subject Information */}
            <CertificateSubjectInfo certificate={certificate} />

            {/* Pending CSR */}
            <PendingCSRSection
                certificate={certificate}
                isEncryptionKeyProvided={isEncryptionKeyProvided}
                onUploadClick={() => setUploadDialogOpen(true)}
            />

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
                <CertificatePEMSection
                    hostname={certificate.hostname}
                    certificatePEM={certificate.certificate_pem}
                />
            )}

            {/* Private Key (PEM) */}
            <PrivateKeySection
                isEncryptionKeyProvided={isEncryptionKeyProvided}
                privateKeyPEM={privateKeyPEM}
                privateKeyLoading={privateKeyLoading}
                privateKeyError={privateKeyError}
                onUnlockClick={() => setShowKeyDialog(true)}
                onDownloadClick={handleDownloadPrivateKey}
            />

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
                            <StatusAlert
                                variant="destructive"
                                icon={
                                    <HugeiconsIcon
                                        icon={AlertCircleIcon}
                                        className="size-4"
                                        strokeWidth={2}
                                    />
                                }
                            >
                                {uploadError}
                            </StatusAlert>
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
                            onClick={closeUploadDialog}
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
