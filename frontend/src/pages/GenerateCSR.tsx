import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCertificates } from "@/hooks/useCertificates";
import { useConfigStore } from "@/stores/useConfigStore";
import { api } from "@/lib/api";
import { csrRequestSchema, type CSRRequestInput } from "@/lib/validation";
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
import { Header } from "@/components/layout/Header";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function GenerateCSR() {
    const navigate = useNavigate();
    const { config, setConfig } = useConfigStore();
    const { generateCSR, isLoading, error } = useCertificates();
    const [sanInputs, setSanInputs] = useState<string[]>([]);

    const {
        register,
        handleSubmit,
        control,
        formState: { errors, isSubmitting },
        reset,
    } = useForm({
        resolver: zodResolver(csrRequestSchema),
    });

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

    useEffect(() => {
        if (config) {
            reset({
                organization: config.default_organization,
                organizational_unit: config.default_organizational_unit || "",
                city: config.default_city,
                state: config.default_state,
                country: config.default_country,
                key_size: config.default_key_size,
            });
        }
    }, [config, reset]);

    const onSubmit = async (data: CSRRequestInput) => {
        const sans = sanInputs.filter((s) => s.trim());
        try {
            const result = await generateCSR({
                ...data,
                sans: sans.length > 0 ? sans : [],
            });
            if (result) {
                navigate(
                    `/certificates/${encodeURIComponent(result.hostname)}`,
                );
            }
        } catch (err) {
            console.error("CSR generation error:", err);
        }
    };

    if (!config) {
        return (
            <div className="flex flex-col h-screen bg-gray-50 dark:bg-slate-950">
                <Header />
                <div className="flex-1 flex items-center justify-center">
                    <LoadingSpinner text="Loading configuration..." />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-slate-950">
            <Header />

            <main className="flex-1 overflow-y-auto scrollbar-float">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Generate CSR
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                Create a new certificate signing request
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate("/")}
                        >
                            ← Back
                        </Button>
                    </div>

                    {error && (
                        <Card className="mb-6 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900">
                            <CardContent>
                                <p className="text-sm text-red-800 dark:text-red-200">
                                    {error}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="shadow-sm border-gray-200 dark:border-gray-800">
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
                                {/* Hostname */}
                                <div className="space-y-2">
                                    <Label htmlFor="hostname">Hostname *</Label>
                                    <Input
                                        id="hostname"
                                        placeholder="example.com"
                                        disabled={isSubmitting || isLoading}
                                        {...register("hostname")}
                                    />
                                    {errors.hostname && (
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                            {errors.hostname.message}
                                        </p>
                                    )}
                                </div>

                                {/* SANs */}
                                <div className="space-y-2">
                                    <Label>
                                        Subject Alternative Names (SANs)
                                    </Label>
                                    <div className="space-y-2">
                                        {sanInputs.map((_, index) => (
                                            <div
                                                key={index}
                                                className="flex gap-2"
                                            >
                                                <Input
                                                    placeholder="example.com"
                                                    disabled={
                                                        isSubmitting ||
                                                        isLoading
                                                    }
                                                    value={sanInputs[index]}
                                                    onChange={(e) => {
                                                        const newSans = [
                                                            ...sanInputs,
                                                        ];
                                                        newSans[index] =
                                                            e.target.value;
                                                        setSanInputs(newSans);
                                                    }}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSanInputs(
                                                            sanInputs.filter(
                                                                (_, i) =>
                                                                    i !== index,
                                                            ),
                                                        );
                                                    }}
                                                    disabled={
                                                        isSubmitting ||
                                                        isLoading
                                                    }
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setSanInputs([...sanInputs, ""])
                                            }
                                            disabled={isSubmitting || isLoading}
                                        >
                                            Add SAN
                                        </Button>
                                    </div>
                                </div>

                                {/* Organization */}
                                <div className="space-y-2">
                                    <Label htmlFor="organization">
                                        Organization *
                                    </Label>
                                    <Input
                                        id="organization"
                                        placeholder="Your Organization"
                                        disabled={isSubmitting || isLoading}
                                        {...register("organization")}
                                    />
                                    {errors.organization && (
                                        <p className="text-sm text-red-600 dark:text-red-400">
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
                                            <p className="text-sm text-red-600 dark:text-red-400">
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
                                            <p className="text-sm text-red-600 dark:text-red-400">
                                                {errors.state.message}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Country */}
                                <div className="space-y-2">
                                    <Label htmlFor="country">
                                        Country Code *
                                    </Label>
                                    <Input
                                        id="country"
                                        placeholder="US"
                                        maxLength={2}
                                        disabled={isSubmitting || isLoading}
                                        {...register("country")}
                                    />
                                    {errors.country && (
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                            {errors.country.message}
                                        </p>
                                    )}
                                </div>

                                {/* Key Size */}
                                <div className="space-y-2">
                                    <Label htmlFor="key_size">
                                        Key Size (bits) *
                                    </Label>
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
                                                    field.onChange(
                                                        parseInt(value),
                                                    )
                                                }
                                                disabled={
                                                    isSubmitting || isLoading
                                                }
                                            >
                                                <SelectTrigger
                                                    className={`w-full ${
                                                        errors.key_size
                                                            ? "border-red-500"
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
                                        <p className="text-sm text-red-600 dark:text-red-400">
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
                                            : "Generate CSR"}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
