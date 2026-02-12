import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "motion/react";
import { useSetup } from "@/hooks/useSetup";
import { useAppStore } from "@/stores/useAppStore";
import { api } from "@/lib/api";
import {
    setupRequestSchema,
    setupStepFields,
    type SetupRequestInput,
} from "@/lib/validation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
    SetupWizardSteps,
    type WizardStep,
    STEPS,
    getStepIndex,
} from "@/components/setup/SetupWizardSteps";
import { UserEmailStep } from "@/components/setup/steps/UserEmailStep";
import { CAConfigStep } from "@/components/setup/steps/CAConfigStep";
import { OrganizationStep } from "@/components/setup/steps/OrganizationStep";
import { CertDefaultsStep } from "@/components/setup/steps/CertDefaultsStep";
import { EncryptionKeyStep } from "@/components/setup/steps/EncryptionKeyStep";
import { ReviewStep } from "@/components/setup/steps/ReviewStep";
import { StatusAlert } from "@/components/shared/StatusAlert";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { stepAnimations } from "@/lib/animations";

function getNextStep(current: WizardStep): WizardStep {
    const currentIndex = getStepIndex(current);
    if (currentIndex < STEPS.length - 1) {
        return STEPS[currentIndex + 1].id;
    }
    return current;
}

function getPreviousStep(current: WizardStep): WizardStep {
    const currentIndex = getStepIndex(current);
    if (currentIndex > 0) {
        return STEPS[currentIndex - 1].id;
    }
    return current;
}

export function SetupWizard() {
    const navigate = useNavigate();
    const { defaults, isLoading, error, loadDefaults, saveSetup, clearError } = useSetup();
    const { setIsUnlocked } = useAppStore();
    const [currentStep, setCurrentStep] = useState<WizardStep>("email");
    const [submitError, setSubmitError] = useState<string | null>(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
    useEffect(() => { loadDefaults(); }, []);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        watch,
        control,
        trigger,
        getValues,
        reset,
    } = useForm<SetupRequestInput>({
        resolver: zodResolver(setupRequestSchema),
        mode: "onChange",
    });

    // Reset form with defaults when they load
    useEffect(() => {
        if (defaults) {
            reset({
                validity_period_days: defaults.validity_period_days,
                default_key_size: defaults.default_key_size,
                default_country: defaults.default_country,
                default_organization: defaults.default_organization,
                default_organizational_unit: defaults.default_organizational_unit || "",
                default_city: defaults.default_city,
                default_state: defaults.default_state,
                password: "",
                password_confirm: "",
            });
        }
    }, [defaults, reset]);

    const handleNext = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const fields = [...setupStepFields[currentStep]] as (keyof SetupRequestInput)[];
        if (fields.length > 0) {
            const isValid = await trigger(fields);
            if (!isValid) return;
        }
        setCurrentStep(getNextStep(currentStep));
    };

    const handlePrevious = () => {
        if (currentStep === "email") {
            navigate("/setup", { replace: true });
        } else {
            setCurrentStep(getPreviousStep(currentStep));
        }
    };

    const handleEditStep = (step: WizardStep) => {
        setCurrentStep(step);
    };

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        // Only handle Enter key
        if (e.key !== "Enter") return;

        // Don't handle if currently submitting
        if (isSubmitting) return;

        // Don't handle if in a textarea
        if ((e.target as HTMLElement).tagName === "TEXTAREA") return;

        // On review step, let the form submit naturally
        if (currentStep === "review") return;

        // Prevent default form submission
        e.preventDefault();

        // Validate current step and go to next
        const fields = [...setupStepFields[currentStep]] as (keyof SetupRequestInput)[];
        if (fields.length > 0) {
            const isValid = await trigger(fields);
            if (!isValid) return;
        }
        setCurrentStep(getNextStep(currentStep));
    };

    const onSubmit = async (data: SetupRequestInput) => {
        // Guard: only allow submission from review step
        if (currentStep !== "review") {
            console.warn("Form submission blocked - not on review step");
            return;
        }

        setSubmitError(null);
        clearError();

        try {
            // First, save the setup configuration (without encryption key)
            const setupData = {
                owner_email: data.owner_email,
                ca_name: data.ca_name,
                hostname_suffix: data.hostname_suffix,
                validity_period_days: data.validity_period_days,
                default_organization: data.default_organization,
                default_organizational_unit: data.default_organizational_unit,
                default_city: data.default_city,
                default_state: data.default_state,
                default_country: data.default_country,
                default_key_size: data.default_key_size,
            };

            await saveSetup(setupData);

            // Then, provide the password
            const keyResult = await api.provideEncryptionKey(data.password);

            if (keyResult.valid) {
                setIsUnlocked(true);
                navigate("/", { replace: true });
            } else {
                setSubmitError("Failed to set password. Please try again.");
            }
        } catch (err) {
            console.error("Setup error:", err);
            setSubmitError(err instanceof Error ? err.message : "Setup failed. Please try again.");
        }
    };

    if (isLoading || !defaults) {
        return (
            <>
                <div className="flex items-center justify-center py-12">
                    <LoadingSpinner text="Loading defaults..." />
                </div>
            </>
        );
    }

    const displayError = submitError || error;

    return (
        <>
            {/* Page Header */}
            <div className="text-center mb-8 space-y-2">
                <h1 className="text-3xl font-bold text-foreground">
                    Configure Your CA
                </h1>
                <p className="text-muted-foreground">
                    Set up your certificate authority with basic information
                </p>
            </div>

            <Card className="shadow-sm border-border">
                {/* Step Indicator */}
                <SetupWizardSteps currentStep={currentStep} />

                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-6">
                        {displayError && (
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
                                {displayError}
                            </StatusAlert>
                        )}

                        <AnimatePresence mode="wait">
                            {currentStep === "email" && (
                                <motion.div
                                    key="email"
                                    {...stepAnimations}
                                >
                                    <UserEmailStep
                                        register={register}
                                        errors={errors}
                                        isSubmitting={isSubmitting}
                                    />
                                </motion.div>
                            )}

                            {currentStep === "ca-config" && (
                                <motion.div
                                    key="ca-config"
                                    {...stepAnimations}
                                >
                                    <CAConfigStep
                                        register={register}
                                        errors={errors}
                                        isSubmitting={isSubmitting}
                                    />
                                </motion.div>
                            )}

                            {currentStep === "organization" && (
                                <motion.div
                                    key="organization"
                                    {...stepAnimations}
                                >
                                    <OrganizationStep
                                        register={register}
                                        errors={errors}
                                        isSubmitting={isSubmitting}
                                    />
                                </motion.div>
                            )}

                            {currentStep === "cert-defaults" && (
                                <motion.div
                                    key="cert-defaults"
                                    {...stepAnimations}
                                >
                                    <CertDefaultsStep
                                        register={register}
                                        errors={errors}
                                        control={control}
                                        isSubmitting={isSubmitting}
                                    />
                                </motion.div>
                            )}

                            {currentStep === "password" && (
                                <motion.div
                                    key="password"
                                    {...stepAnimations}
                                >
                                    <EncryptionKeyStep
                                        register={register}
                                        errors={errors}
                                        watch={watch}
                                        isSubmitting={isSubmitting}
                                    />
                                </motion.div>
                            )}

                            {currentStep === "review" && (
                                <motion.div
                                    key="review"
                                    {...stepAnimations}
                                >
                                    <ReviewStep
                                        getValues={getValues}
                                        onEditStep={handleEditStep}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Navigation Buttons */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handlePrevious}
                                disabled={isSubmitting}
                                className="flex-1"
                            >
                                Back
                            </Button>
                            {currentStep !== "review" ? (
                                <Button
                                    type="button"
                                    onClick={handleNext}
                                    disabled={isSubmitting}
                                    className="flex-1"
                                >
                                    Continue
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1"
                                >
                                    {isSubmitting ? "Setting up..." : "Create CA"}
                                </Button>
                            )}
                        </div>
                    </form>
                </CardContent>
            </Card>
        </>
    );
}
