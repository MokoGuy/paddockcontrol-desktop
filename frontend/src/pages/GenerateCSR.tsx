import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCertificates } from "@/hooks/useCertificates";
import { useSetup } from "@/hooks/useSetup";
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
import { CodeBlock } from "@/components/ui/code-block";

export function GenerateCSR() {
    const navigate = useNavigate();
    const { defaults, loadDefaults } = useSetup();
    const { generateCSR, isLoading, error, downloadCSR } = useCertificates();
    const [step, setStep] = useState<"form" | "result">("form");
    const [csrResult, setCSRResult] = useState<{
        hostname: string;
        csr: string;
        message: string;
    } | null>(null);
    const [sanInputs, setSanInputs] = useState<string[]>([]);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        watch,
    } = useForm({
        resolver: zodResolver(csrRequestSchema),
    });

    const keySize = watch("key_size");

    useEffect(() => {
        loadDefaults();
    }, []);

    const onSubmit = async (data: CSRRequestInput) => {
        const sans = sanInputs.filter((s) => s.trim());
        try {
            const result = await generateCSR({
                ...data,
                sans: sans.length > 0 ? sans : [],
            });
            if (result) {
                setCSRResult(result);
                setStep("result");
            }
        } catch (err) {
            console.error("CSR generation error:", err);
        }
    };

    const handleDownload = async () => {
        if (!csrResult) return;
        try {
            await downloadCSR(csrResult.hostname, csrResult.csr);
        } catch (err) {
            console.error("Download error:", err);
        }
    };

    if (!defaults) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
                <Header />
                <div className="flex items-center justify-center min-h-[60vh]">
                    <LoadingSpinner text="Loading defaults..." />
                </div>
            </div>
        );
    }

    if (step === "result" && csrResult) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
                <Header />
                <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            CSR Generated
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Your certificate signing request is ready
                        </p>
                    </div>

                    <Card className="mb-6 shadow-sm border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950">
                        <CardContent>
                            <p className="text-sm text-green-800 dark:text-green-200">
                                ✓ CSR generated successfully for{" "}
                                {csrResult.hostname}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
                        <CardHeader>
                            <CardTitle>Certificate Signing Request</CardTitle>
                            <CardDescription>
                                Send this to your certificate authority
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <CodeBlock
                                content={csrResult.csr}
                                maxHeight="max-h-64"
                            />
                        </CardContent>
                    </Card>

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => navigate("/dashboard")}
                            className="flex-1"
                        >
                            Back to Dashboard
                        </Button>
                        <Button onClick={handleDownload} className="flex-1">
                            Download CSR File
                        </Button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <Header />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Generate CSR
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Create a new certificate signing request
                    </p>
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
                                <Label>Subject Alternative Names (SANs)</Label>
                                <div className="space-y-2">
                                    {sanInputs.map((_, index) => (
                                        <div key={index} className="flex gap-2">
                                            <Input
                                                placeholder="example.com"
                                                disabled={
                                                    isSubmitting || isLoading
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
                                                    isSubmitting || isLoading
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
                                <Label htmlFor="country">Country Code *</Label>
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
                                <Input
                                    id="key_size"
                                    type="number"
                                    placeholder="4096"
                                    disabled={isSubmitting || isLoading}
                                    {...register("key_size", {
                                        valueAsNumber: true,
                                    })}
                                />
                                {errors.key_size && (
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                        {errors.key_size.message}
                                    </p>
                                )}
                                <p className="text-xs text-blue-700 dark:text-blue-300">
                                    Current: {keySize} bits. Larger keys (4096+)
                                    are more secure.
                                </p>
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
                            <div className="flex gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => navigate("/dashboard")}
                                    disabled={isSubmitting || isLoading}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || isLoading}
                                    className="flex-1"
                                >
                                    {isSubmitting || isLoading
                                        ? "Generating..."
                                        : "Generate CSR"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
