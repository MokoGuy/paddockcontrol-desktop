import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
    Certificate,
    CertificateListItem,
    CSRRequest,
    CSRResponse,
    ImportRequest,
    CertificateFilter,
} from "@/types";
import { useCertificateStore } from "@/stores/useCertificateStore";

interface UseCertificatesReturn {
    certificates: CertificateListItem[];
    isLoading: boolean;
    error: string | null;

    // Operations
    listCertificates: (filter?: CertificateFilter) => Promise<void>;
    getCertificate: (hostname: string) => Promise<Certificate | null>;
    generateCSR: (req: CSRRequest) => Promise<CSRResponse | null>;
    uploadCertificate: (hostname: string, certPEM: string) => Promise<void>;
    importCertificate: (req: ImportRequest) => Promise<void>;
    deleteCertificate: (hostname: string) => Promise<void>;
    setCertificateReadOnly: (hostname: string, readOnly: boolean) => Promise<void>;
    downloadCSR: (hostname: string, csr: string) => Promise<void>;
    downloadCertificate: (hostname: string, cert: string) => Promise<void>;
    downloadPrivateKey: (hostname: string) => Promise<void>;

    // Utilities
    clearError: () => void;
    refresh: () => Promise<void>;
}

export function useCertificates(): UseCertificatesReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { certificates, setCertificates } = useCertificateStore();

    const handleError = useCallback((err: unknown) => {
        // Wails returns error messages as strings, not Error objects
        const message =
            err instanceof Error ? err.message :
            typeof err === "string" ? err :
            "An error occurred";
        setError(message);
        console.error("Certificate operation error:", err);
    }, []);

    const listCertificates = useCallback(async (filter: CertificateFilter = {}) => {
        setIsLoading(true);
        setError(null);
        try {
            const certs = await api.listCertificates(filter);
            setCertificates(certs || []);
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    }, [setCertificates, handleError]);

    const getCertificate = useCallback(async (
        hostname: string,
    ): Promise<Certificate | null> => {
        setIsLoading(true);
        setError(null);
        try {
            return await api.getCertificate(hostname);
        } catch (err) {
            handleError(err);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [handleError]);

    const generateCSR = useCallback(async (
        req: CSRRequest,
    ): Promise<CSRResponse | null> => {
        setIsLoading(true);
        setError(null);
        try {
            return await api.generateCSR(req);
        } catch (err) {
            handleError(err);
            throw err; // Re-throw so caller can handle field-level errors
        } finally {
            setIsLoading(false);
        }
    }, [handleError]);

    const uploadCertificate = useCallback(async (hostname: string, certPEM: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await api.uploadCertificate(hostname, certPEM);
            const certs = await api.listCertificates({});
            setCertificates(certs || []);
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    }, [setCertificates, handleError]);

    const importCertificate = useCallback(async (req: ImportRequest) => {
        setIsLoading(true);
        setError(null);
        try {
            await api.importCertificate(req);
            const certs = await api.listCertificates({});
            setCertificates(certs || []);
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    }, [setCertificates, handleError]);

    const deleteCertificate = useCallback(async (hostname: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await api.deleteCertificate(hostname);
            const certs = await api.listCertificates({});
            setCertificates(certs || []);
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    }, [setCertificates, handleError]);

    const setCertificateReadOnly = useCallback(async (hostname: string, readOnly: boolean) => {
        setIsLoading(true);
        setError(null);
        try {
            await api.setCertificateReadOnly(hostname, readOnly);
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    }, [handleError]);

    const downloadCSR = useCallback(async (hostname: string) => {
        setError(null);
        try {
            await api.saveCSRToFile(hostname);
        } catch (err) {
            handleError(err);
        }
    }, [handleError]);

    const downloadCertificate = useCallback(async (hostname: string) => {
        setError(null);
        try {
            await api.saveCertificateToFile(hostname);
        } catch (err) {
            handleError(err);
        }
    }, [handleError]);

    const downloadPrivateKey = useCallback(async (hostname: string) => {
        setError(null);
        try {
            await api.savePrivateKeyToFile(hostname);
        } catch (err) {
            handleError(err);
        }
    }, [handleError]);

    const refresh = useCallback(async () => {
        const certs = await api.listCertificates({});
        setCertificates(certs || []);
    }, [setCertificates]);

    const clearError = useCallback(() => setError(null), []);

    return {
        certificates,
        isLoading,
        error,
        listCertificates,
        getCertificate,
        generateCSR,
        uploadCertificate,
        importCertificate,
        deleteCertificate,
        setCertificateReadOnly,
        downloadCSR,
        downloadCertificate,
        downloadPrivateKey,
        clearError,
        refresh,
    };
}
