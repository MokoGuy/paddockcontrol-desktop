import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import { useCertificates } from "@/hooks/useCertificates";
import { useConfigStore } from "@/stores/useConfigStore";
import { useAppStore } from "@/stores/useAppStore";
import { api } from "@/lib/api";
import {
    csrRequestSchema,
    type CSRRequestInput,
    type SANType,
    hasSuffix,
    detectSANType,
    validateIP,
} from "@/lib/validation";
import { parseBackendError } from "@/lib/error-parser";
import { Certificate, CSRRequest } from "@/types";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { StatusAlert } from "@/components/shared/StatusAlert";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    InputGroup,
    InputGroupInput,
    InputGroupAddon,
    InputGroupButton,
} from "@/components/ui/input-group";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";

interface LocationState {
    renewal?: string;
    regenerate?: string;
}

// SAN entry with UI state
interface SANInputEntry {
    value: string;
    type: SANType;
}

export function GenerateCSR() {
    const navigate = useNavigate();
    const location = useLocation();
    const { config, setConfig } = useConfigStore();
    const { isEncryptionKeyProvided, isAdminModeEnabled } = useAppStore();
    const { generateCSR, getCertificate, isLoading } = useCertificates();
    const [sanInputs, setSanInputs] = useState<SANInputEntry[]>([]);
    const [skipSuffixValidation, setSkipSuffixValidation] = useState(false);
    const [sanError, setSanError] = useState<string | null>(null);
    const [generalError, setGeneralError] = useState<string | null>(null);

    // Extract mode from navigation state
    const locationState = location.state as LocationState | null;
    const renewalHostname = locationState?.renewal;
    const regenerateHostname = locationState?.regenerate;
    const isRenewalMode = !!renewalHostname;
    const isRegenerateMode = !!regenerateHostname;
    const existingHostname = renewalHostname || regenerateHostname;

    // State for loading existing certificate data
    const [existingCertificate, setExistingCertificate] =
        useState<Certificate | null>(null);
    const [certLoading, setCertLoading] = useState(false);

    const {
        register,
        handleSubmit,
        control,
        watch,
        formState: { errors, isSubmitting },
        reset,
        setValue,
        setError,
    } = useForm({
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

    const hostname = watch("hostname");

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

    // Load existing certificate data for renewal/regenerate modes
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

    // Helper to strip hostname suffix
    const stripHostnameSuffix = (hostname: string, suffix: string) => {
        if (suffix && hostname.endsWith(suffix)) {
            return hostname.slice(0, -suffix.length);
        }
        return hostname;
    };

    // Reset form with appropriate values based on mode
    useEffect(() => {
        if (!config) return;
        // Wait for certificate data in renewal/regenerate modes
        if ((isRenewalMode || isRegenerateMode) && !existingCertificate) return;

        const suffix = config.hostname_suffix || "";

        if (isRegenerateMode && existingCertificate) {
            // Use pending CSR data for regenerate
            const baseHostname = stripHostnameSuffix(
                existingCertificate.hostname,
                suffix,
            );
            // Extract additional SANs (excluding the primary hostname) with type detection
            const additionalSans = (
                existingCertificate.pending_sans || []
            ).filter((san) => san !== existingCertificate.hostname);
            setSanInputs(
                additionalSans.map((san) => ({
                    value: stripHostnameSuffix(san, suffix),
                    type: detectSANType(san),
                })),
            );

            const formValues = {
                hostname: baseHostname,
                organization:
                    existingCertificate.pending_organization ||
                    config.default_organization,
                organizational_unit:
                    existingCertificate.pending_organizational_unit ||
                    config.default_organizational_unit ||
                    "",
                city:
                    existingCertificate.pending_city || config.default_city,
                state:
                    existingCertificate.pending_state || config.default_state,
                country:
                    existingCertificate.pending_country ||
                    config.default_country,
                key_size:
                    existingCertificate.pending_key_size ??
                    config.default_key_size ??
                    4096,
                note: "",
            };
            reset(formValues);
            // Explicitly set key_size after a tick to ensure Controller updates
            setTimeout(() => setValue("key_size", formValues.key_size), 0);
        } else if (isRenewalMode && existingCertificate) {
            // Use certificate data for renewal
            const baseHostname = stripHostnameSuffix(
                existingCertificate.hostname,
                suffix,
            );
            // Extract additional SANs (excluding the primary hostname) with type detection
            const additionalSans = (existingCertificate.sans || []).filter(
                (san) => san !== existingCertificate.hostname,
            );
            setSanInputs(
                additionalSans.map((san) => ({
                    value: stripHostnameSuffix(san, suffix),
                    type: detectSANType(san),
                })),
            );

            const formValues = {
                hostname: baseHostname,
                organization:
                    existingCertificate.organization ||
                    config.default_organization,
                organizational_unit:
                    existingCertificate.organizational_unit ||
                    config.default_organizational_unit ||
                    "",
                city: existingCertificate.city || config.default_city,
                state: existingCertificate.state || config.default_state,
                country: existingCertificate.country || config.default_country,
                key_size:
                    existingCertificate.key_size ??
                    config.default_key_size ??
                    4096,
                note: "",
            };
            reset(formValues);
            // Explicitly set key_size after a tick to ensure Controller updates
            setTimeout(() => setValue("key_size", formValues.key_size), 0);
        } else {
            // Default: use config defaults for new CSR
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

    // Route protection: redirect if certificate is read-only (for renewal/regenerate)
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
    }, [
        isRenewalMode,
        isRegenerateMode,
        existingCertificate,
        existingHostname,
        navigate,
    ]);

    const onSubmit = async (data: CSRRequestInput) => {
        // Clear previous errors
        setGeneralError(null);
        setSanError(null);

        // === CLIENT-SIDE VALIDATION ===

        // 1. Hostname suffix validation (unless bypass enabled)
        if (!skipSuffixValidation && config?.hostname_suffix) {
            if (!hasSuffix(data.hostname, config.hostname_suffix)) {
                setError("hostname", {
                    type: "manual",
                    message: `Hostname must end with ${config.hostname_suffix}`,
                });
                return;
            }
        }

        // 2. SAN IP validation
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

        // === END CLIENT-SIDE VALIDATION ===

        // Build typed SANs list
        const typedSans: Array<{ value: string; type: string }> = [];

        // Add hostname as first SAN (always DNS type)
        typedSans.push({
            value: data.hostname,
            type: "dns",
        });

        // Add additional SANs with their types
        for (const san of sanInputs) {
            if (!san.value.trim()) continue;
            typedSans.push({
                value: san.value,
                type: san.type,
            });
        }

        // Build the request object (will be cast to CSRRequest by the API layer)
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
                navigate(
                    `/certificates/${encodeURIComponent(result.hostname)}`,
                );
            }
        } catch (err) {
            // Wails returns error messages as strings, not Error objects
            const errorMessage =
                err instanceof Error ? err.message :
                typeof err === "string" ? err :
                "An unexpected error occurred";
            const parsed = parseBackendError(errorMessage);

            // Apply field-level errors
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

            // Set general error for unmapped errors
            if (parsed.generalError) {
                setGeneralError(parsed.generalError);
            }
        }
    };

    // Show loading state while config or certificate is loading, or if redirect is pending
    if (
        !config ||
        certLoading ||
        !isEncryptionKeyProvided ||
        ((isRenewalMode || isRegenerateMode) && existingCertificate?.read_only)
    ) {
        return (
            <div className="flex items-center justify-center py-12">
                <LoadingSpinner
                    text={
                        certLoading
                            ? "Loading certificate data..."
                            : "Loading configuration..."
                    }
                />
            </div>
        );
    }

    // Derive page title and description based on mode
    const pageTitle = isRegenerateMode
        ? "Regenerate CSR"
        : isRenewalMode
          ? "Renew Certificate"
          : "Generate CSR";
    const pageDescription = isRegenerateMode
        ? "Create a new certificate signing request to replace the current pending CSR"
        : isRenewalMode
          ? "Create a new certificate signing request for renewal"
          : "Create a new certificate signing request";

    return (
        <>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">
                        {pageTitle}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {pageDescription}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        existingHostname
                            ? navigate(
                                  `/certificates/${encodeURIComponent(existingHostname)}`,
                              )
                            : navigate("/")
                    }
                >
                    ← Back
                </Button>
            </div>

            {generalError && (
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
                    {generalError}
                </StatusAlert>
            )}

            <Card className="shadow-sm border-border relative overflow-hidden">
                {/* Loading overlay during key generation */}
                <AnimatePresence>
                    {(isSubmitting || isLoading) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg"
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                            >
                                <LoadingSpinner
                                    size="lg"
                                    text={`Generating ${watch("key_size")}-bit key... This may take a few seconds`}
                                />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <CardHeader>
                    <CardTitle>Request Details</CardTitle>
                    <CardDescription>
                        Fill in the certificate information
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
                        {/* Admin Bypass Checkbox */}
                        <div className="flex items-center space-x-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="skip_suffix_validation"
                                            checked={skipSuffixValidation}
                                            onCheckedChange={(checked) =>
                                                setSkipSuffixValidation(
                                                    checked === true,
                                                )
                                            }
                                            disabled={
                                                !isAdminModeEnabled ||
                                                isSubmitting ||
                                                isLoading
                                            }
                                        />
                                        <Label
                                            htmlFor="skip_suffix_validation"
                                            className={
                                                !isAdminModeEnabled
                                                    ? "text-muted-foreground cursor-not-allowed"
                                                    : "cursor-pointer"
                                            }
                                        >
                                            Bypass hostname suffix enforcement
                                        </Label>
                                    </div>
                                </TooltipTrigger>
                                {!isAdminModeEnabled && (
                                    <TooltipContent>
                                        <p>Only available in admin mode</p>
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </div>

                        {/* Hostname */}
                        <div className="space-y-2">
                            <Label htmlFor="hostname">Hostname *</Label>
                            <InputGroup
                                className={
                                    isRenewalMode || isRegenerateMode
                                        ? "bg-muted"
                                        : "bg-background"
                                }
                            >
                                <InputGroupInput
                                    id="hostname"
                                    placeholder="server.example.com"
                                    className="cursor-text"
                                    disabled={
                                        isSubmitting ||
                                        isLoading ||
                                        isRenewalMode ||
                                        isRegenerateMode
                                    }
                                    {...register("hostname")}
                                />
                                {config?.hostname_suffix && (
                                    <InputGroupAddon align="inline-end">
                                        <InputGroupButton
                                            onClick={() => {
                                                const suffix =
                                                    config.hostname_suffix;
                                                if (
                                                    hostname &&
                                                    !hasSuffix(
                                                        hostname,
                                                        suffix,
                                                    )
                                                ) {
                                                    setValue(
                                                        "hostname",
                                                        hostname + suffix,
                                                    );
                                                }
                                            }}
                                            disabled={
                                                isSubmitting ||
                                                isLoading ||
                                                isRenewalMode ||
                                                isRegenerateMode ||
                                                !hostname ||
                                                hasSuffix(
                                                    hostname || "",
                                                    config?.hostname_suffix ||
                                                        "",
                                                )
                                            }
                                        >
                                            +{config.hostname_suffix}
                                        </InputGroupButton>
                                    </InputGroupAddon>
                                )}
                            </InputGroup>
                            {errors.hostname && (
                                <p className="text-sm text-destructive">
                                    {errors.hostname.message}
                                </p>
                            )}
                        </div>

                        {/* SANs */}
                        <div className="space-y-2">
                            <Label>Subject Alternative Names (SANs)</Label>
                            <p className="text-xs text-muted-foreground">
                                The hostname will be automatically included as
                                the first SAN entry.
                            </p>
                            <p className="text-xs text-muted-foreground">
                                This is required for browser validation of
                                server certificates.
                            </p>
                            <div className="space-y-2">
                                {/* Show hostname as first SAN */}
                                <div className="flex gap-2">
                                    <Select value="dns" disabled>
                                        <SelectTrigger className="w-24 bg-muted">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="dns">
                                                DNS
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputGroup className="flex-1 bg-muted">
                                        <InputGroupInput
                                            value={hostname || ""}
                                            placeholder="Enter hostname first"
                                            disabled
                                        />
                                    </InputGroup>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled
                                        className="opacity-50 w-24"
                                    >
                                        Primary
                                    </Button>
                                </div>
                                {sanInputs.map((san, index) => (
                                    <div key={index} className="flex gap-2">
                                        <Select
                                            value={san.type}
                                            onValueChange={(
                                                value: SANType,
                                            ) => {
                                                const newSans = [
                                                    ...sanInputs,
                                                ];
                                                newSans[index] = {
                                                    ...newSans[index],
                                                    type: value,
                                                };
                                                setSanInputs(newSans);
                                            }}
                                            disabled={
                                                isSubmitting || isLoading
                                            }
                                        >
                                            <SelectTrigger className="w-24">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="dns">
                                                    DNS
                                                </SelectItem>
                                                <SelectItem value="ip">
                                                    IP
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputGroup className="flex-1 bg-background">
                                            <InputGroupInput
                                                placeholder={
                                                    san.type === "dns"
                                                        ? "server.example.com"
                                                        : "192.168.1.100 or 2001:db8::1"
                                                }
                                                className="cursor-text"
                                                disabled={
                                                    isSubmitting || isLoading
                                                }
                                                value={san.value}
                                                onChange={(e) => {
                                                    const newSans = [
                                                        ...sanInputs,
                                                    ];
                                                    newSans[index] = {
                                                        ...newSans[index],
                                                        value: e.target.value,
                                                    };
                                                    setSanInputs(newSans);
                                                }}
                                            />
                                            {san.type !== "ip" &&
                                                config?.hostname_suffix && (
                                                    <InputGroupAddon align="inline-end">
                                                        <InputGroupButton
                                                            onClick={() => {
                                                                const suffix =
                                                                    config.hostname_suffix;
                                                                if (
                                                                    san.value &&
                                                                    !hasSuffix(
                                                                        san.value,
                                                                        suffix,
                                                                    )
                                                                ) {
                                                                    const newSans =
                                                                        [
                                                                            ...sanInputs,
                                                                        ];
                                                                    newSans[
                                                                        index
                                                                    ] = {
                                                                        ...newSans[
                                                                            index
                                                                        ],
                                                                        value:
                                                                            san.value +
                                                                            suffix,
                                                                    };
                                                                    setSanInputs(
                                                                        newSans,
                                                                    );
                                                                }
                                                            }}
                                                            disabled={
                                                                isSubmitting ||
                                                                isLoading ||
                                                                !san.value ||
                                                                hasSuffix(
                                                                    san.value,
                                                                    config?.hostname_suffix ||
                                                                        "",
                                                                )
                                                            }
                                                        >
                                                            +
                                                            {
                                                                config.hostname_suffix
                                                            }
                                                        </InputGroupButton>
                                                    </InputGroupAddon>
                                                )}
                                        </InputGroup>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setSanInputs(
                                                    sanInputs.filter(
                                                        (_, i) => i !== index,
                                                    ),
                                                );
                                            }}
                                            disabled={isSubmitting || isLoading}
                                            className="w-24"
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        setSanInputs([
                                            ...sanInputs,
                                            { value: "", type: "dns" },
                                        ])
                                    }
                                    disabled={isSubmitting || isLoading}
                                >
                                    Add SAN
                                </Button>
                                {sanError && (
                                    <p className="text-sm text-destructive">
                                        {sanError}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Organization */}
                        <div className="space-y-2">
                            <Label htmlFor="organization">Organization *</Label>
                            <Input
                                id="organization"
                                placeholder="Your Organization"
                                disabled={isSubmitting || isLoading}
                                {...register("organization")}
                            />
                            {errors.organization && (
                                <p className="text-sm text-destructive">
                                    {errors.organization.message}
                                </p>
                            )}
                        </div>

                        {/* Organizational Unit */}
                        <div className="space-y-2">
                            <Label htmlFor="organizational_unit">
                                Organizational Unit
                            </Label>
                            <Input
                                id="organizational_unit"
                                placeholder="IT Department"
                                disabled={isSubmitting || isLoading}
                                {...register("organizational_unit")}
                            />
                        </div>

                        {/* Two Column Layout */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="city">City *</Label>
                                <Input
                                    id="city"
                                    placeholder="San Francisco"
                                    disabled={isSubmitting || isLoading}
                                    {...register("city")}
                                />
                                {errors.city && (
                                    <p className="text-sm text-destructive">
                                        {errors.city.message}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="state">State *</Label>
                                <Input
                                    id="state"
                                    placeholder="California"
                                    disabled={isSubmitting || isLoading}
                                    {...register("state")}
                                />
                                {errors.state && (
                                    <p className="text-sm text-destructive">
                                        {errors.state.message}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Country */}
                        <div className="space-y-2">
                            <Label htmlFor="country">Country Code *</Label>
                            <Input
                                id="country"
                                placeholder="US"
                                maxLength={2}
                                disabled={isSubmitting || isLoading}
                                {...register("country")}
                            />
                            {errors.country && (
                                <p className="text-sm text-destructive">
                                    {errors.country.message}
                                </p>
                            )}
                        </div>

                        {/* Key Size */}
                        <div className="space-y-2">
                            <Label htmlFor="key_size">Key Size (bits) *</Label>
                            <Controller
                                name="key_size"
                                control={control}
                                rules={{
                                    required: "Key size is required",
                                }}
                                render={({ field }) => (
                                    <Select
                                        value={field.value?.toString()}
                                        onValueChange={(value) =>
                                            field.onChange(parseInt(value))
                                        }
                                        disabled={isSubmitting || isLoading}
                                    >
                                        <SelectTrigger
                                            className={`w-full ${
                                                errors.key_size
                                                    ? "border-destructive"
                                                    : ""
                                            }`}
                                        >
                                            <SelectValue placeholder="Select key size" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="2048">
                                                2048 bits
                                            </SelectItem>
                                            <SelectItem value="3072">
                                                3072 bits
                                            </SelectItem>
                                            <SelectItem value="4096">
                                                4096 bits (Recommended)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.key_size && (
                                <p className="text-sm text-destructive">
                                    {errors.key_size.message}
                                </p>
                            )}
                        </div>

                        {/* Note */}
                        <div className="space-y-2">
                            <Label htmlFor="note">Note</Label>
                            <Textarea
                                id="note"
                                placeholder="Add any notes for this certificate..."
                                disabled={isSubmitting || isLoading}
                                rows={3}
                                {...register("note")}
                            />
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <Button
                                type="submit"
                                disabled={isSubmitting || isLoading}
                                className="w-full"
                            >
                                {isSubmitting || isLoading
                                    ? "Generating..."
                                    : isRegenerateMode
                                      ? "Regenerate CSR"
                                      : isRenewalMode
                                        ? "Generate Renewal CSR"
                                        : "Generate CSR"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </>
    );
}
