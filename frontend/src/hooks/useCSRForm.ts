import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useCertificates } from "@/hooks/useCertificates";
import { useConfigStore } from "@/stores/useConfigStore";
import { useAppStore } from "@/stores/useAppStore";
import { api } from "@/lib/api";
import {
    csrRequestSchema,
    type CSRRequestInput,
    detectSANType,
    validateIP,
    hasSuffix,
} from "@/lib/validation";
import { parseBackendError } from "@/lib/error-parser";
import type { Certificate, CSRRequest } from "@/types";
import type { SANInputEntry } from "@/components/certificate/SANEditor";

interface UseCSRFormOptions {
    renewalHostname?: string;
    regenerateHostname?: string;
}

export function useCSRForm(options: UseCSRFormOptions = {}) {
    const { renewalHostname, regenerateHostname } = options;
    const navigate = useNavigate();
    const { config, setConfig } = useConfigStore();
    const { isEncryptionKeyProvided } = useAppStore();
    const { generateCSR, getCertificate, isLoading } = useCertificates();

    const [sanInputs, setSanInputs] = useState<SANInputEntry[]>([]);
    const [skipSuffixValidation, setSkipSuffixValidation] = useState(false);
    const [sanError, setSanError] = useState<string | null>(null);
    const [generalError, setGeneralError] = useState<string | null>(null);
    const [existingCertificate, setExistingCertificate] = useState<Certificate | null>(null);
    const [certLoading, setCertLoading] = useState(false);

    const isRenewalMode = !!renewalHostname;
    const isRegenerateMode = !!regenerateHostname;
    const existingHostname = renewalHostname || regenerateHostname;

    const form = useForm<CSRRequestInput>({
        resolver: zodResolver(csrRequestSchema),
        defaultValues: {
            hostname: "",
            organization: config?.default_organization ?? "",
            organizational_unit: config?.default_organizational_unit ?? "",
            city: config?.default_city ?? "",
            state: config?.default_state ?? "",
            country: config?.default_country ?? "",
            key_size: config?.default_key_size ?? 4096,
            note: "",
        },
    });

    const { reset, setValue, setError, watch } = form;
    const hostname = watch("hostname");

    // Load config on mount
    useEffect(() => {
        const loadConfig = async () => {
            if (!config) {
                try {
                    const cfg = await api.getConfig();
                    setConfig(cfg);
                } catch (err) {
                    console.error("Failed to load config:", err);
                }
            }
        };
        loadConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load existing certificate for renewal/regenerate
    useEffect(() => {
        const loadExistingCertificate = async () => {
            if (!existingHostname) return;

            setCertLoading(true);
            try {
                const cert = await getCertificate(existingHostname);
                if (cert) {
                    setExistingCertificate(cert);
                }
            } catch (err) {
                console.error("Failed to load certificate:", err);
            } finally {
                setCertLoading(false);
            }
        };
        loadExistingCertificate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [existingHostname]);

    // Reset form with appropriate values based on mode
    useEffect(() => {
        if (!config) return;
        if ((isRenewalMode || isRegenerateMode) && !existingCertificate) return;

        if (isRegenerateMode && existingCertificate) {
            const baseHostname = existingCertificate.hostname;
            const additionalSans = (existingCertificate.pending_sans || []).filter(
                (san) => san !== existingCertificate.hostname
            );
            setSanInputs(
                additionalSans.map((san) => ({
                    value: san,
                    type: detectSANType(san),
                }))
            );

            const formValues = {
                hostname: baseHostname,
                organization: existingCertificate.pending_organization || config.default_organization,
                organizational_unit: existingCertificate.pending_organizational_unit || config.default_organizational_unit || "",
                city: existingCertificate.pending_city || config.default_city,
                state: existingCertificate.pending_state || config.default_state,
                country: existingCertificate.pending_country || config.default_country,
                key_size: existingCertificate.pending_key_size ?? config.default_key_size ?? 4096,
                note: "",
            };
            reset(formValues);
            setTimeout(() => setValue("key_size", formValues.key_size), 0);
        } else if (isRenewalMode && existingCertificate) {
            const baseHostname = existingCertificate.hostname;
            const additionalSans = (existingCertificate.sans || []).filter(
                (san) => san !== existingCertificate.hostname
            );
            setSanInputs(
                additionalSans.map((san) => ({
                    value: san,
                    type: detectSANType(san),
                }))
            );

            const formValues = {
                hostname: baseHostname,
                organization: existingCertificate.organization || config.default_organization,
                organizational_unit: existingCertificate.organizational_unit || config.default_organizational_unit || "",
                city: existingCertificate.city || config.default_city,
                state: existingCertificate.state || config.default_state,
                country: existingCertificate.country || config.default_country,
                key_size: existingCertificate.key_size ?? config.default_key_size ?? 4096,
                note: "",
            };
            reset(formValues);
            setTimeout(() => setValue("key_size", formValues.key_size), 0);
        } else {
            reset({
                hostname: "",
                organization: config.default_organization,
                organizational_unit: config.default_organizational_unit ?? "",
                city: config.default_city,
                state: config.default_state,
                country: config.default_country,
                key_size: config.default_key_size ?? 4096,
                note: "",
            });
        }
    }, [config, reset, setValue, isRenewalMode, isRegenerateMode, existingCertificate]);

    // Route protection: redirect if encryption key not provided
    useEffect(() => {
        if (!isEncryptionKeyProvided) {
            navigate("/", { replace: true });
        }
    }, [isEncryptionKeyProvided, navigate]);

    // Route protection: redirect if certificate is read-only
    useEffect(() => {
        if (
            (isRenewalMode || isRegenerateMode) &&
            existingCertificate &&
            existingCertificate.read_only
        ) {
            navigate(`/certificates/${encodeURIComponent(existingHostname!)}`, {
                replace: true,
            });
        }
    }, [isRenewalMode, isRegenerateMode, existingCertificate, existingHostname, navigate]);

    const onSubmit = async (data: CSRRequestInput) => {
        setGeneralError(null);
        setSanError(null);

        // Hostname suffix validation
        if (!skipSuffixValidation && config?.hostname_suffix) {
            if (!hasSuffix(data.hostname, config.hostname_suffix)) {
                setError("hostname", {
                    type: "manual",
                    message: `Hostname must end with ${config.hostname_suffix}`,
                });
                return;
            }
        }

        // SAN IP validation
        for (const san of sanInputs) {
            if (!san.value.trim()) continue;
            if (san.type === "ip") {
                const ipError = validateIP(san.value);
                if (ipError) {
                    setSanError(ipError);
                    return;
                }
            }
        }

        // Build typed SANs list
        const typedSans: Array<{ value: string; type: string }> = [];
        typedSans.push({ value: data.hostname, type: "dns" });

        for (const san of sanInputs) {
            if (!san.value.trim()) continue;
            typedSans.push({ value: san.value, type: san.type });
        }

        const csrRequest = {
            hostname: data.hostname,
            sans: typedSans,
            organization: data.organization,
            organizational_unit: data.organizational_unit || "",
            city: data.city,
            state: data.state,
            country: data.country,
            key_size: data.key_size,
            note: data.note || "",
            is_renewal: isRenewalMode || isRegenerateMode,
            skip_suffix_validation: skipSuffixValidation,
        } as CSRRequest;

        try {
            const result = await generateCSR(csrRequest);
            if (result) {
                navigate(`/certificates/${encodeURIComponent(result.hostname)}`);
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message :
                typeof err === "string" ? err :
                "An unexpected error occurred";
            const parsed = parseBackendError(errorMessage);

            for (const fieldError of parsed.fieldErrors) {
                if (fieldError.field === "sans") {
                    setSanError(fieldError.message);
                } else {
                    setError(fieldError.field as keyof CSRRequestInput, {
                        type: "server",
                        message: fieldError.message,
                    });
                }
            }

            if (parsed.generalError) {
                setGeneralError(parsed.generalError);
            }
        }
    };

    return {
        form,
        hostname,
        sanInputs,
        setSanInputs,
        skipSuffixValidation,
        setSkipSuffixValidation,
        sanError,
        generalError,
        existingCertificate,
        certLoading,
        isRenewalMode,
        isRegenerateMode,
        existingHostname,
        isLoading,
        config,
        onSubmit,
    };
}
