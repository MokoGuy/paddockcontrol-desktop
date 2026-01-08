import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSetup } from "@/hooks/useSetup";
import { setupRequestSchema, type SetupRequestInput } from "@/lib/validation";
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
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import logo from "@/assets/images/logo-universal.png";

export function SetupWizard() {
    const navigate = useNavigate();
    const { defaults, isLoading, error, loadDefaults, saveSetup } = useSetup();

    useEffect(() => {
        loadDefaults();
    }, []);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        watch,
    } = useForm<SetupRequestInput>({
        resolver: zodResolver(setupRequestSchema),
        defaultValues: defaults
            ? {
                  validity_period_days: defaults.validity_period_days,
                  default_key_size: defaults.default_key_size,
                  default_country: defaults.default_country,
              }
            : undefined,
    });

    const keySize = watch("default_key_size");

    const onSubmit = async (data: SetupRequestInput) => {
        try {
            await saveSetup(data);
            navigate("/", { replace: true });
        } catch (err) {
            console.error("Setup error:", err);
        }
    };

    if (isLoading || !defaults) {
        return (
            <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
                <LoadingSpinner text="Loading defaults..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8 space-y-4">
                    <img
                        src={logo}
                        alt="PaddockControl"
                        className="w-12 h-12 mx-auto"
                    />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Configure Your CA
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">
                            Set up your certificate authority with basic
                            information
                        </p>
                    </div>
                </div>

                <Card className="shadow-xl border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <CardTitle>CA Configuration</CardTitle>
                        <CardDescription>
                            Provide the necessary information for your
                            certificate authority
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            onSubmit={handleSubmit(onSubmit)}
                            className="space-y-6"
                        >
                            {error && (
                                <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg">
                                    <p className="text-sm text-red-800 dark:text-red-200">
                                        {error}
                                    </p>
                                </div>
                            )}

                            {/* Owner Email */}
                            <div className="space-y-2">
                                <Label htmlFor="owner_email">
                                    Owner Email *
                                </Label>
                                <Input
                                    id="owner_email"
                                    type="email"
                                    placeholder="admin@example.com"
                                    disabled={isSubmitting}
                                    {...register("owner_email")}
                                />
                                {errors.owner_email && (
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                        {errors.owner_email.message}
                                    </p>
                                )}
                            </div>

                            {/* CA Name */}
                            <div className="space-y-2">
                                <Label htmlFor="ca_name">CA Name *</Label>
                                <Input
                                    id="ca_name"
                                    placeholder="My Company CA"
                                    disabled={isSubmitting}
                                    {...register("ca_name")}
                                />
                                {errors.ca_name && (
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                        {errors.ca_name.message}
                                    </p>
                                )}
                            </div>

                            {/* Hostname Suffix */}
                            <div className="space-y-2">
                                <Label htmlFor="hostname_suffix">
                                    Hostname Suffix *
                                </Label>
                                <Input
                                    id="hostname_suffix"
                                    placeholder=".example.com"
                                    disabled={isSubmitting}
                                    {...register("hostname_suffix")}
                                />
                                {errors.hostname_suffix && (
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                        {errors.hostname_suffix.message}
                                    </p>
                                )}
                            </div>

                            {/* Organization */}
                            <div className="space-y-2">
                                <Label htmlFor="default_organization">
                                    Organization *
                                </Label>
                                <Input
                                    id="default_organization"
                                    placeholder="Acme Corporation"
                                    disabled={isSubmitting}
                                    {...register("default_organization")}
                                />
                                {errors.default_organization && (
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                        {errors.default_organization.message}
                                    </p>
                                )}
                            </div>

                            {/* Organizational Unit */}
                            <div className="space-y-2">
                                <Label htmlFor="default_organizational_unit">
                                    Organizational Unit
                                </Label>
                                <Input
                                    id="default_organizational_unit"
                                    placeholder="IT Department"
                                    disabled={isSubmitting}
                                    {...register("default_organizational_unit")}
                                />
                                {errors.default_organizational_unit && (
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                        {
                                            errors.default_organizational_unit
                                                .message
                                        }
                                    </p>
                                )}
                            </div>

                            {/* Two Column Layout */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* City */}
                                <div className="space-y-2">
                                    <Label htmlFor="default_city">City *</Label>
                                    <Input
                                        id="default_city"
                                        placeholder="San Francisco"
                                        disabled={isSubmitting}
                                        {...register("default_city")}
                                    />
                                    {errors.default_city && (
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                            {errors.default_city.message}
                                        </p>
                                    )}
                                </div>

                                {/* State */}
                                <div className="space-y-2">
                                    <Label htmlFor="default_state">
                                        State *
                                    </Label>
                                    <Input
                                        id="default_state"
                                        placeholder="California"
                                        disabled={isSubmitting}
                                        {...register("default_state")}
                                    />
                                    {errors.default_state && (
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                            {errors.default_state.message}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Country */}
                            <div className="space-y-2">
                                <Label htmlFor="default_country">
                                    Country Code *
                                </Label>
                                <Input
                                    id="default_country"
                                    placeholder="US"
                                    maxLength={2}
                                    disabled={isSubmitting}
                                    {...register("default_country")}
                                />
                                {errors.default_country && (
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                        {errors.default_country.message}
                                    </p>
                                )}
                            </div>

                            {/* Two Column: Validity and Key Size */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Validity Period */}
                                <div className="space-y-2">
                                    <Label htmlFor="validity_period_days">
                                        Validity Period (days) *
                                    </Label>
                                    <Input
                                        id="validity_period_days"
                                        type="number"
                                        placeholder="365"
                                        disabled={isSubmitting}
                                        {...register("validity_period_days", {
                                            valueAsNumber: true,
                                        })}
                                    />
                                    {errors.validity_period_days && (
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                            {
                                                errors.validity_period_days
                                                    .message
                                            }
                                        </p>
                                    )}
                                </div>

                                {/* Key Size */}
                                <div className="space-y-2">
                                    <Label htmlFor="default_key_size">
                                        Key Size (bits) *
                                    </Label>
                                    <Input
                                        id="default_key_size"
                                        type="number"
                                        placeholder="4096"
                                        disabled={isSubmitting}
                                        {...register("default_key_size", {
                                            valueAsNumber: true,
                                        })}
                                    />
                                    {errors.default_key_size && (
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                            {errors.default_key_size.message}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Key Size Info */}
                            <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg">
                                <p className="text-xs text-blue-800 dark:text-blue-200">
                                    💡 Current key size:{" "}
                                    <strong>{keySize} bits</strong>. Larger keys
                                    (4096+) are more secure but slower to
                                    generate. Minimum is 2048 bits.
                                </p>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        navigate("/setup", { replace: true })
                                    }
                                    disabled={isSubmitting}
                                    className="flex-1"
                                >
                                    Back
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1"
                                >
                                    {isSubmitting
                                        ? "Setting up..."
                                        : "Create CA"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
