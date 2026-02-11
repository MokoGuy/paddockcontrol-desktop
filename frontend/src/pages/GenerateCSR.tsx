import { useNavigate, useLocation } from "react-router-dom";
import { Controller } from "react-hook-form";
import { AnimatePresence, motion } from "motion/react";
import { useAppStore } from "@/stores/useAppStore";
import { useCSRForm } from "@/hooks/useCSRForm";
import { hasSuffix } from "@/lib/validation";
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
import { SANEditor } from "@/components/certificate/SANEditor";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";

interface LocationState {
    renewal?: string;
    regenerate?: string;
}

export function GenerateCSR() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isEncryptionKeyProvided, isAdminModeEnabled } = useAppStore();

    // Extract mode from navigation state
    const locationState = location.state as LocationState | null;
    const renewalHostname = locationState?.renewal;
    const regenerateHostname = locationState?.regenerate;

    const {
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
    } = useCSRForm({ renewalHostname, regenerateHostname });

    const {
        register,
        handleSubmit,
        control,
        watch,
        formState: { errors, isSubmitting },
        setValue,
    } = form;

    // Show loading state while config or certificate is loading
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
                    <h1 className="text-3xl font-bold text-foreground">{pageTitle}</h1>
                    <p className="text-muted-foreground mt-1">{pageDescription}</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        existingHostname
                            ? navigate(`/certificates/${encodeURIComponent(existingHostname)}`)
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
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10"
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
                    <CardDescription>Fill in the certificate information</CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {/* Admin Bypass Checkbox */}
                        <div className="flex items-center space-x-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="skip_suffix_validation"
                                            checked={skipSuffixValidation}
                                            onCheckedChange={(checked) =>
                                                setSkipSuffixValidation(checked === true)
                                            }
                                            disabled={!isAdminModeEnabled || isSubmitting || isLoading}
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
                                    isRenewalMode || isRegenerateMode ? "bg-muted" : "bg-background"
                                }
                            >
                                <InputGroupInput
                                    id="hostname"
                                    placeholder="server.example.com"
                                    className="cursor-text"
                                    disabled={
                                        isSubmitting || isLoading || isRenewalMode || isRegenerateMode
                                    }
                                    {...register("hostname")}
                                />
                                {config?.hostname_suffix && (
                                    <InputGroupAddon align="inline-end">
                                        <InputGroupButton
                                            onClick={() => {
                                                const suffix = config.hostname_suffix;
                                                if (hostname && !hasSuffix(hostname, suffix)) {
                                                    setValue("hostname", hostname + suffix);
                                                }
                                            }}
                                            disabled={
                                                isSubmitting ||
                                                isLoading ||
                                                isRenewalMode ||
                                                isRegenerateMode ||
                                                !hostname ||
                                                hasSuffix(hostname || "", config?.hostname_suffix || "")
                                            }
                                        >
                                            +{config.hostname_suffix}
                                        </InputGroupButton>
                                    </InputGroupAddon>
                                )}
                            </InputGroup>
                            {errors.hostname && (
                                <p className="text-sm text-destructive">{errors.hostname.message}</p>
                            )}
                        </div>

                        {/* SANs - Using extracted component */}
                        <SANEditor
                            sanInputs={sanInputs}
                            setSanInputs={setSanInputs}
                            hostname={hostname || ""}
                            hostnameSuffix={config?.hostname_suffix}
                            disabled={isSubmitting || isLoading}
                            error={sanError}
                        />

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
                            <Label htmlFor="organizational_unit">Organizational Unit</Label>
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
                                    <p className="text-sm text-destructive">{errors.city.message}</p>
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
                                    <p className="text-sm text-destructive">{errors.state.message}</p>
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
                                <p className="text-sm text-destructive">{errors.country.message}</p>
                            )}
                        </div>

                        {/* Key Size */}
                        <div className="space-y-2">
                            <Label htmlFor="key_size">Key Size (bits) *</Label>
                            <Controller
                                name="key_size"
                                control={control}
                                rules={{ required: "Key size is required" }}
                                render={({ field }) => (
                                    <Select
                                        value={field.value?.toString()}
                                        onValueChange={(value) => field.onChange(parseInt(value))}
                                        disabled={isSubmitting || isLoading}
                                    >
                                        <SelectTrigger
                                            className={`w-full ${
                                                errors.key_size ? "border-destructive" : ""
                                            }`}
                                        >
                                            <SelectValue placeholder="Select key size" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="2048">2048 bits</SelectItem>
                                            <SelectItem value="3072">3072 bits</SelectItem>
                                            <SelectItem value="4096">4096 bits (Recommended)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.key_size && (
                                <p className="text-sm text-destructive">{errors.key_size.message}</p>
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
