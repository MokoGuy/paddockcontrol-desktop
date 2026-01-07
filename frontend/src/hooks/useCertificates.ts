import { useState } from "react";
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

    const handleError = (err: unknown) => {
        const message =
            err instanceof Error ? err.message : "An error occurred";
        setError(message);
        console.error("Certificate operation error:", err);
    };

    const listCertificates = async (filter: CertificateFilter = {}) => {
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
    };

    const getCertificate = async (
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
    };

    const generateCSR = async (
        req: CSRRequest,
    ): Promise<CSRResponse | null> => {
        setIsLoading(true);
        setError(null);
        try {
            return await api.generateCSR(req);
        } catch (err) {
            handleError(err);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const uploadCertificate = async (hostname: string, certPEM: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await api.uploadCertificate(hostname, certPEM);
            await listCertificates();
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const importCertificate = async (req: ImportRequest) => {
        setIsLoading(true);
        setError(null);
        try {
            await api.importCertificate(req);
            await listCertificates();
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteCertificate = async (hostname: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await api.deleteCertificate(hostname);
            await listCertificates();
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const downloadCSR = async (hostname: string) => {
        setError(null);
        try {
            await api.saveCSRToFile(hostname);
        } catch (err) {
            handleError(err);
        }
    };

    const downloadCertificate = async (hostname: string) => {
        setError(null);
        try {
            await api.saveCertificateToFile(hostname);
        } catch (err) {
            handleError(err);
        }
    };

    const downloadPrivateKey = async (hostname: string) => {
        setError(null);
        try {
            await api.savePrivateKeyToFile(hostname);
        } catch (err) {
            handleError(err);
        }
    };

    const refresh = async () => {
        await listCertificates();
    };

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
        downloadCSR,
        downloadCertificate,
        downloadPrivateKey,
        clearError: () => setError(null),
        refresh,
    };
}
