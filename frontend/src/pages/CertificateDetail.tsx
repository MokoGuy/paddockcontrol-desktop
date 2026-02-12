import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { PendingPrivateKeySection } from "@/components/certificate/PendingPrivateKeySection";
import { CertificateDescriptionEditor } from "@/components/certificate/CertificateDescriptionEditor";
import { CertificateHistoryCard } from "@/components/certificate/CertificateHistoryCard";
import { ExportDialog } from "@/components/certificate/ExportDialog";
import { useCertificateDetail } from "@/hooks/useCertificateDetail";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { AdminGatedButton } from "@/components/shared/AdminGatedButton";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    RefreshIcon,
    Delete02Icon,
    AlertCircleIcon,
    CheckmarkCircle02Icon,
    Cancel01Icon,
    Link04Icon,
    Download04Icon,
    SquareLock02Icon,
    SquareUnlock02Icon,
} from "@hugeicons/core-free-icons";
import { StatusBadge } from "@/components/certificate/StatusBadge";
import { RenewalBadge } from "@/components/certificate/RenewalBadge";
import { ReadOnlyBadge } from "@/components/certificate/ReadOnlyBadge";
import { formatDateTime, pendingCardStyles } from "@/lib/theme";
import { tabTransition } from "@/lib/animations";
import { ReadOnlyFade } from "@/components/shared/ReadOnlyFade";

export function CertificateDetail() {
    const { hostname } = useParams<{ hostname: string }>();
    const {
        certificate,
        isLoading,
        error,
        certError,
        certLoading,
        backupLoading,
        isUnlocked,
        chain,
        chainLoading,
        chainError,
        privateKeyPEM,
        privateKeyLoading,
        privateKeyError,
        pendingPrivateKeyPEM,
        pendingPrivateKeyLoading,
        pendingPrivateKeyError,
        history,
        historyLoading,
        historyError,
        deleteConfirming,
        setDeleteConfirming,
        cancelRenewalConfirming,
        setCancelRenewalConfirming,
        uploadDialogOpen,
        setUploadDialogOpen,
        uploadCertPEM,
        setUploadCertPEM,
        uploadError,
        setUploadError,
        isUploading,
        uploadStep,
        setUploadStep,
        uploadPreview,
        isPreviewing,
        exportDialogOpen,
        setExportDialogOpen,
        showKeyDialog,
        setShowKeyDialog,
        isTogglingReadOnly,
        handleDelete,
        handleCancelRenewal,
        handlePreviewUpload,
        handleUploadCertificate,
        handleToggleReadOnly,
        handleSaveCurrentNote,
        handleSavePendingNote,
        closeUploadDialog,
        navigate,
    } = useCertificateDetail({ hostname });

    // Tab state - user selection with automatic fallback when tab becomes invalid
    const [selectedTab, setSelectedTab] = useState<string | null>(null);

    const activeTab = useMemo(() => {
        if (!certificate) return "activity";
        // If user has selected a tab and it's still valid, use it
        if (selectedTab === "certificate" && certificate.certificate_pem) return "certificate";
        if (selectedTab === "pending" && certificate.pending_csr) return "pending";
        if (selectedTab === "activity") return "activity";
        // Default: prefer certificate tab, then pending, then activity
        if (certificate.certificate_pem) return "certificate";
        if (certificate.pending_csr) return "pending";
        return "activity";
    }, [certificate, selectedTab]);

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
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-foreground">
                    {certificate.hostname}
                </h1>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/")}
                >
                    ← Back
                </Button>
            </div>
            <div className="-mt-4 mb-6">
                <div className="flex items-center gap-2">
                    <StatusBadge
                        status={certificate.status}
                        daysUntilExpiration={certificate.days_until_expiration}
                    />
                    <AnimatePresence mode="popLayout">
                        {certificate.pending_csr && certificate.status !== "pending" && (
                            <RenewalBadge key="renewal-badge" />
                        )}
                        {certificate.read_only && (
                            <ReadOnlyBadge key="read-only-badge" />
                        )}
                    </AnimatePresence>
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
            {!isUnlocked && (
                <LimitedModeNotice
                    className="mb-6"
                    onProvideKey={() => setShowKeyDialog(true)}
                />
            )}

            {/* Tabbed Content */}
            <Tabs value={activeTab} onValueChange={setSelectedTab}>
                <div className="flex items-center justify-between mb-6">
                    <TabsList variant="line">
                        {certificate.certificate_pem && (
                            <TabsTrigger value="certificate">Certificate</TabsTrigger>
                        )}
                        {certificate.pending_csr && (
                            <TabsTrigger value="pending">Pending</TabsTrigger>
                        )}
                        <TabsTrigger value="activity">Activity</TabsTrigger>
                    </TabsList>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleReadOnly(!certificate.read_only)}
                            disabled={isTogglingReadOnly}
                        >
                            <HugeiconsIcon
                                icon={certificate.read_only ? SquareUnlock02Icon : SquareLock02Icon}
                                className="w-4 h-4 mr-1"
                                strokeWidth={2}
                            />
                            {certificate.read_only ? "Unlock" : "Lock"}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExportDialogOpen(true)}
                        >
                            <HugeiconsIcon
                                icon={Download04Icon}
                                className="w-4 h-4 mr-1"
                                strokeWidth={2}
                            />
                            Export
                        </Button>
                        <ReadOnlyFade readOnly={certificate.read_only}>
                            <AdminGatedButton
                                variant="outline"
                                size="sm"
                                requireAdminMode={false}
                                requireUnlocked
                                disabled={certificate.read_only}
                                disabledReason={certificate.read_only ? "Certificate is read-only" : undefined}
                                onClick={() =>
                                    navigate("/certificates/generate", {
                                        state: certificate.pending_csr
                                            ? { regenerate: certificate.hostname }
                                            : { renewal: certificate.hostname },
                                    })
                                }
                            >
                                <HugeiconsIcon
                                    icon={RefreshIcon}
                                    className="w-4 h-4 mr-1"
                                    strokeWidth={2}
                                />
                                {certificate.pending_csr ? "Regenerate" : "Renew"}
                            </AdminGatedButton>
                        </ReadOnlyFade>
                        <ReadOnlyFade readOnly={certificate.read_only}>
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
                        </ReadOnlyFade>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                {/* Certificate Tab */}
                {certificate.certificate_pem && activeTab === "certificate" && (
                    <TabsContent value="certificate" forceMount asChild>
                        <motion.div
                            key="certificate"
                            {...tabTransition}
                        >
                        <CertificateDescriptionEditor
                            note={certificate.note || ""}
                            onSave={handleSaveCurrentNote}
                            disabled={certificate.read_only}
                        />

                        <CertificateStatusSection certificate={certificate} />

                        <CertificateSubjectInfo certificate={certificate} />

                        <CertificatePath
                            chain={chain}
                            isLoading={chainLoading}
                            error={chainError}
                        />

                        <CertificatePEMSection
                            certificatePEM={certificate.certificate_pem}
                        />

                        {/* Chain connector: Certificate PEM ↔ Active Private Key */}
                        <div className={`flex items-center justify-center gap-2 -mt-4 mb-2 text-xs ${isUnlocked && privateKeyPEM ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                            <div className="h-px flex-1 bg-border" />
                            <HugeiconsIcon
                                icon={Link04Icon}
                                className="size-3.5 shrink-0"
                                strokeWidth={2}
                            />
                            <span className="shrink-0">
                                {isUnlocked && privateKeyPEM
                                    ? "Cryptographically paired"
                                    : "Certificate & key present but not verified"}
                            </span>
                            <div className="h-px flex-1 bg-border" />
                        </div>

                        <PrivateKeySection
                            isUnlocked={isUnlocked}
                            privateKeyPEM={privateKeyPEM}
                            privateKeyLoading={privateKeyLoading}
                            privateKeyError={privateKeyError}
                        />
                        </motion.div>
                    </TabsContent>
                )}

                {/* Pending Tab */}
                {certificate.pending_csr && activeTab === "pending" && (
                    <TabsContent value="pending" forceMount asChild>
                        <motion.div
                            key="pending"
                            {...tabTransition}
                        >
                        <CertificateDescriptionEditor
                            note={certificate.pending_note || ""}
                            placeholder="Click to add pending CSR note..."
                            onSave={handleSavePendingNote}
                            disabled={certificate.read_only}
                        />

                        <CertificateStatusSection certificate={certificate} variant="pending" />

                        <CertificateSubjectInfo certificate={certificate} variant="pending" />

                        <PendingCSRSection
                            certificate={certificate}
                            onUploadClick={() => setUploadDialogOpen(true)}
                            onCancelRenewal={handleCancelRenewal}
                            cancelRenewalConfirming={cancelRenewalConfirming}
                            setCancelRenewalConfirming={setCancelRenewalConfirming}
                            isLoading={certLoading}
                        />

                        {/* Chain connector: Pending CSR ↔ Pending Private Key */}
                        <div className={`flex items-center justify-center gap-2 -mt-4 mb-2 text-xs ${isUnlocked && pendingPrivateKeyPEM ? pendingCardStyles.connectorText : "text-muted-foreground/60"}`}>
                            <div className={`h-px flex-1 ${isUnlocked && pendingPrivateKeyPEM ? pendingCardStyles.connectorLine : "bg-border"}`} />
                            <HugeiconsIcon
                                icon={Link04Icon}
                                className="size-3.5 shrink-0"
                                strokeWidth={2}
                            />
                            <span className="shrink-0">
                                {isUnlocked && pendingPrivateKeyPEM
                                    ? "Cryptographically paired"
                                    : "Certificate & key present but not verified"}
                            </span>
                            <div className={`h-px flex-1 ${isUnlocked && pendingPrivateKeyPEM ? pendingCardStyles.connectorLine : "bg-border"}`} />
                        </div>

                        <PendingPrivateKeySection
                            hasPendingCSR={!!certificate.pending_csr}
                            isUnlocked={isUnlocked}
                            pendingPrivateKeyPEM={pendingPrivateKeyPEM}
                            pendingPrivateKeyLoading={pendingPrivateKeyLoading}
                            pendingPrivateKeyError={pendingPrivateKeyError}
                        />
                        </motion.div>
                    </TabsContent>
                )}

                {/* Activity Tab */}
                {activeTab === "activity" && (
                    <TabsContent value="activity" forceMount asChild>
                        <motion.div
                            key="activity"
                            {...tabTransition}
                        >
                            <CertificateHistoryCard
                                history={history}
                                isLoading={historyLoading}
                                error={historyError}
                            />
                        </motion.div>
                    </TabsContent>
                )}
                </AnimatePresence>
            </Tabs>

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

            {/* Upload Certificate Dialog (2-step: input → preview) */}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    {uploadStep === "input" ? (
                        <>
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
                                    onClick={handlePreviewUpload}
                                    disabled={isPreviewing || !uploadCertPEM.trim()}
                                >
                                    {isPreviewing
                                        ? "Validating..."
                                        : "Preview"}
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>Confirm Certificate Upload</DialogTitle>
                                <DialogDescription>
                                    Review the certificate details before uploading.
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
                                {uploadPreview && (
                                    <div className="rounded-none border border-border bg-muted/50 p-4 space-y-3 text-sm">
                                        <div className="flex items-center gap-2">
                                            <HugeiconsIcon
                                                icon={uploadPreview.csr_match ? CheckmarkCircle02Icon : Cancel01Icon}
                                                className={`size-5 ${uploadPreview.csr_match ? "text-emerald-500" : "text-destructive"}`}
                                                strokeWidth={2}
                                            />
                                            <span className={uploadPreview.csr_match ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-destructive font-medium"}>
                                                {uploadPreview.csr_match ? "Certificate matches pending CSR" : "Certificate does NOT match pending CSR"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <HugeiconsIcon
                                                icon={uploadPreview.key_match ? CheckmarkCircle02Icon : Cancel01Icon}
                                                className={`size-5 ${uploadPreview.key_match ? "text-emerald-500" : "text-destructive"}`}
                                                strokeWidth={2}
                                            />
                                            <span className={uploadPreview.key_match ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-destructive font-medium"}>
                                                {uploadPreview.key_match ? "Certificate matches pending private key" : "Certificate does NOT match pending private key"}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                                            <span className="text-muted-foreground">Hostname</span>
                                            <span className="font-mono">{uploadPreview.hostname}</span>
                                            <span className="text-muted-foreground">Issuer</span>
                                            <span>{uploadPreview.issuer_cn}{uploadPreview.issuer_o ? ` (${uploadPreview.issuer_o})` : ""}</span>
                                            <span className="text-muted-foreground">Valid From</span>
                                            <span>{formatDateTime(uploadPreview.not_before)}</span>
                                            <span className="text-muted-foreground">Valid Until</span>
                                            <span>{formatDateTime(uploadPreview.not_after)}</span>
                                            <span className="text-muted-foreground">Key Size</span>
                                            <span>{uploadPreview.key_size} bit</span>
                                            {uploadPreview.sans && uploadPreview.sans.length > 0 && (
                                                <>
                                                    <span className="text-muted-foreground">SANs</span>
                                                    <span>{uploadPreview.sans.join(", ")}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setUploadStep("input");
                                        setUploadError(null);
                                    }}
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={handleUploadCertificate}
                                    disabled={isUploading || !uploadPreview?.csr_match || !uploadPreview?.key_match}
                                >
                                    {isUploading
                                        ? "Uploading..."
                                        : "Confirm Upload"}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Export Dialog */}
            <ExportDialog
                open={exportDialogOpen}
                onOpenChange={setExportDialogOpen}
                certificate={certificate}
                isUnlocked={isUnlocked}
            />

            {/* Encryption Key Dialog */}
            <EncryptionKeyDialog
                open={showKeyDialog}
                onClose={() => setShowKeyDialog(false)}
            />
        </>
    );
}
