import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCertificates } from "@/hooks/useCertificates";
import { useBackup } from "@/hooks/useBackup";
import { useAppStore } from "@/stores/useAppStore";
import { api } from "@/lib/api";
import type { Certificate, ChainCertificateInfo, HistoryEntry, CertificateUploadPreview } from "@/types";

interface UseCertificateDetailOptions {
    hostname?: string;
}

export function useCertificateDetail({ hostname }: UseCertificateDetailOptions) {
    const navigate = useNavigate();
    const {
        getCertificate,
        deleteCertificate,
        uploadCertificate,
        setCertificateReadOnly,
        isLoading: certLoading,
        error: certError,
    } = useCertificates();
    const { isLoading: backupLoading } = useBackup();
    const { isUnlocked } = useAppStore();

    // Certificate state
    const [certificate, setCertificate] = useState<Certificate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirming, setDeleteConfirming] = useState(false);
    const [cancelRenewalConfirming, setCancelRenewalConfirming] = useState(false);

    // Upload certificate dialog state
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [uploadCertPEM, setUploadCertPEM] = useState("");
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStep, setUploadStep] = useState<"input" | "preview">("input");
    const [uploadPreview, setUploadPreview] = useState<CertificateUploadPreview | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);

    // Certificate chain state
    const [chain, setChain] = useState<ChainCertificateInfo[]>([]);
    const [chainLoading, setChainLoading] = useState(false);
    const [chainError, setChainError] = useState<string | null>(null);

    // Active private key state
    const [privateKeyPEM, setPrivateKeyPEM] = useState<string | null>(null);
    const [privateKeyLoading, setPrivateKeyLoading] = useState(false);
    const [privateKeyError, setPrivateKeyError] = useState<string | null>(null);

    // Pending private key state
    const [pendingPrivateKeyPEM, setPendingPrivateKeyPEM] = useState<string | null>(null);
    const [pendingPrivateKeyLoading, setPendingPrivateKeyLoading] = useState(false);
    const [pendingPrivateKeyError, setPendingPrivateKeyError] = useState<string | null>(null);

    // Export dialog state
    const [exportDialogOpen, setExportDialogOpen] = useState(false);

    // Encryption key dialog state
    const [showKeyDialog, setShowKeyDialog] = useState(false);

    // Read-only toggle state
    const [isTogglingReadOnly, setIsTogglingReadOnly] = useState(false);

    // Note saving state
    const [isSavingNote, setIsSavingNote] = useState(false);

    // History state
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);

    // Load certificate
    const loadCertificate = useCallback(async () => {
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
    }, [hostname, getCertificate]);

    // Load certificate chain
    const loadCertificateChain = useCallback(async () => {
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
    }, [hostname, certificate?.certificate_pem]);

    // Load private key
    const loadPrivateKey = useCallback(async () => {
        if (!hostname || !isUnlocked) return;

        setPrivateKeyLoading(true);
        setPrivateKeyError(null);
        try {
            const pem = await api.getPrivateKeyPEM(hostname);
            setPrivateKeyPEM(pem);
        } catch (err) {
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
    }, [hostname, isUnlocked]);

    // Load pending private key
    const loadPendingPrivateKey = useCallback(async () => {
        if (!hostname || !isUnlocked || !certificate?.pending_csr) return;

        setPendingPrivateKeyLoading(true);
        setPendingPrivateKeyError(null);
        try {
            const pem = await api.getPendingPrivateKeyPEM(hostname);
            setPendingPrivateKeyPEM(pem);
        } catch (err) {
            const message =
                typeof err === "string"
                    ? err
                    : err instanceof Error
                      ? err.message
                      : "Failed to load pending private key";
            setPendingPrivateKeyError(message);
        } finally {
            setPendingPrivateKeyLoading(false);
        }
    }, [hostname, isUnlocked, certificate?.pending_csr]);

    // Load certificate history
    const loadHistory = useCallback(async () => {
        if (!hostname) return;

        setHistoryLoading(true);
        setHistoryError(null);
        try {
            const historyData = await api.getCertificateHistory(hostname);
            setHistory(historyData || []);
        } catch (err) {
            setHistoryError(
                err instanceof Error
                    ? err.message
                    : "Failed to load history",
            );
        } finally {
            setHistoryLoading(false);
        }
    }, [hostname]);

    // Load certificate on hostname change
    useEffect(() => {
        loadCertificate();
    }, [loadCertificate]);

    // Load chain when certificate PEM is available
    useEffect(() => {
        if (certificate?.certificate_pem) {
            loadCertificateChain();
        }
    }, [certificate?.certificate_pem, loadCertificateChain]);

    // Load private key when certificate and encryption key are available
    useEffect(() => {
        if (certificate && isUnlocked) {
            loadPrivateKey();
        }
    }, [certificate, isUnlocked, loadPrivateKey]);

    // Load pending private key when certificate has pending CSR and encryption key is available
    useEffect(() => {
        if (certificate?.pending_csr && isUnlocked) {
            loadPendingPrivateKey();
        }
    }, [certificate?.pending_csr, isUnlocked, loadPendingPrivateKey]);

    // Load history when certificate is available
    useEffect(() => {
        if (certificate) {
            loadHistory();
        }
    }, [certificate, loadHistory]);

    // Event handlers
    const handleDelete = useCallback(async () => {
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
    }, [hostname, deleteCertificate, navigate]);

    const handleCancelRenewal = useCallback(async () => {
        if (!hostname) return;
        try {
            await api.clearPendingCSR(hostname);
            setCancelRenewalConfirming(false);
            await loadCertificate();
            await loadHistory();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to cancel renewal",
            );
        }
    }, [hostname, loadCertificate, loadHistory]);

    const handlePreviewUpload = useCallback(async () => {
        if (!hostname || !uploadCertPEM.trim()) return;

        if (!uploadCertPEM.includes("-----BEGIN CERTIFICATE-----")) {
            setUploadError("Invalid certificate format. Must be PEM encoded.");
            return;
        }

        setIsPreviewing(true);
        setUploadError(null);

        try {
            const preview = await api.previewCertificateUpload(hostname, uploadCertPEM.trim());
            setUploadPreview(preview);
            setUploadStep("preview");
        } catch (err) {
            setUploadError(
                err instanceof Error ? err.message : "Preview failed",
            );
        } finally {
            setIsPreviewing(false);
        }
    }, [hostname, uploadCertPEM]);

    const handleUploadCertificate = useCallback(async () => {
        if (!hostname || !uploadCertPEM.trim()) return;

        setIsUploading(true);
        setUploadError(null);

        try {
            await uploadCertificate(hostname, uploadCertPEM.trim());
            setUploadDialogOpen(false);
            setUploadCertPEM("");
            setUploadStep("input");
            setUploadPreview(null);
            await loadCertificate();
        } catch (err) {
            setUploadError(
                err instanceof Error ? err.message : "Upload failed",
            );
        } finally {
            setIsUploading(false);
        }
    }, [hostname, uploadCertPEM, uploadCertificate, loadCertificate]);

    const handleToggleReadOnly = useCallback(async (checked: boolean) => {
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
    }, [hostname, certificate, setCertificateReadOnly]);

    const handleSaveCurrentNote = useCallback(
        async (note: string) => {
            if (!hostname) return;
            setIsSavingNote(true);
            try {
                await api.updateCertificateNote(hostname, note);
                if (certificate) {
                    setCertificate({ ...certificate, note });
                }
            } finally {
                setIsSavingNote(false);
            }
        },
        [hostname, certificate]
    );

    const handleSavePendingNote = useCallback(
        async (note: string) => {
            if (!hostname) return;
            setIsSavingNote(true);
            try {
                await api.updatePendingNote(hostname, note);
                if (certificate) {
                    setCertificate({ ...certificate, pending_note: note });
                }
            } finally {
                setIsSavingNote(false);
            }
        },
        [hostname, certificate]
    );

    const closeUploadDialog = useCallback(() => {
        setUploadDialogOpen(false);
        setUploadCertPEM("");
        setUploadError(null);
        setUploadStep("input");
        setUploadPreview(null);
    }, []);

    return {
        // Certificate data
        certificate,
        isLoading,
        error,
        certError,
        certLoading,
        backupLoading,
        isUnlocked,

        // Chain data
        chain,
        chainLoading,
        chainError,

        // Active private key data
        privateKeyPEM,
        privateKeyLoading,
        privateKeyError,

        // Pending private key data
        pendingPrivateKeyPEM,
        pendingPrivateKeyLoading,
        pendingPrivateKeyError,

        // History data
        history,
        historyLoading,
        historyError,

        // Dialog states
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

        // Read-only state
        isTogglingReadOnly,

        // Note state
        isSavingNote,

        // Handlers
        handleDelete,
        handleCancelRenewal,
        handlePreviewUpload,
        handleUploadCertificate,
        handleToggleReadOnly,
        handleSaveCurrentNote,
        handleSavePendingNote,
        closeUploadDialog,
        navigate,
    };
}
