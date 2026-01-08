import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCertificates } from "@/hooks/useCertificates";
import {
    importCertificateSchema,
    type ImportCertificateInput,
} from "@/lib/validation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/layout/Header";
import { FileDropTextarea } from "@/components/shared/FileDropTextarea";

export function ImportCertificate() {
    const navigate = useNavigate();
    const { importCertificate, isLoading, error } = useCertificates();
    const [step, setStep] = useState<"form" | "confirm">("form");

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        watch,
        control,
    } = useForm<ImportCertificateInput>({
        resolver: zodResolver(importCertificateSchema),
    });

    const certificatePem = watch("certificate_pem");
    const privateKeyPem = watch("private_key_pem");

    const onSubmit = async (data: ImportCertificateInput) => {
        try {
            await importCertificate(data);
            navigate("/", { replace: true });
        } catch (err) {
            console.error("Import error:", err);
        }
    };

    if (step === "confirm" && certificatePem && privateKeyPem) {
        return (
            <div className="flex flex-col h-screen bg-gray-50 dark:bg-slate-950">
                <Header />
                <main className="flex-1 overflow-y-auto scrollbar-float">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Confirm Import
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                Review the certificate before importing
                            </p>
                        </div>

                        <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
                            <CardHeader>
                                <CardTitle>Certificate Preview</CardTitle>
                                <CardDescription>
                                    Certificate in PEM format
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-48 border border-gray-700 scrollbar-float">
                                    {certificatePem.substring(0, 500)}...
                                </pre>
                            </CardContent>
                        </Card>

                        <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
                            <CardHeader>
                                <CardTitle>Private Key Preview</CardTitle>
                                <CardDescription>
                                    Private key in PEM format
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-48 border border-gray-700 scrollbar-float">
                                    {privateKeyPem.substring(0, 200)}...
                                </pre>
                            </CardContent>
                        </Card>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setStep("form")}
                                className="flex-1"
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleSubmit(onSubmit)}
                                disabled={isSubmitting || isLoading}
                                className="flex-1"
                            >
                                {isSubmitting || isLoading
                                    ? "Importing..."
                                    : "Import Certificate"}
                            </Button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-slate-950">
            <Header />

            <main className="flex-1 overflow-y-auto scrollbar-float">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Import Certificate
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Import an existing SSL/TLS certificate with its
                            private key
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
                            <CardTitle>Certificate Details</CardTitle>
                            <CardDescription>
                                Provide your certificate and private key in PEM
                                format
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form
                                onSubmit={handleSubmit(() =>
                                    setStep("confirm"),
                                )}
                                className="space-y-6"
                            >
                                {/* Certificate PEM */}
                                <div className="space-y-2">
                                    <Label htmlFor="certificate_pem">
                                        Certificate (PEM) *
                                    </Label>
                                    <Controller
                                        name="certificate_pem"
                                        control={control}
                                        render={({ field }) => (
                                            <FileDropTextarea
                                                value={field.value || ""}
                                                onChange={field.onChange}
                                                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                                                disabled={
                                                    isSubmitting || isLoading
                                                }
                                                rows={6}
                                                dropLabel="Drop certificate file here"
                                                acceptedExtensions={[
                                                    ".crt",
                                                    ".pem",
                                                    ".cer",
                                                    ".txt",
                                                ]}
                                                className="font-mono text-xs"
                                            />
                                        )}
                                    />
                                    {errors.certificate_pem && (
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                            {errors.certificate_pem.message}
                                        </p>
                                    )}
                                </div>

                                {/* Private Key PEM */}
                                <div className="space-y-2">
                                    <Label htmlFor="private_key_pem">
                                        Private Key (PEM) *
                                    </Label>
                                    <Controller
                                        name="private_key_pem"
                                        control={control}
                                        render={({ field }) => (
                                            <FileDropTextarea
                                                value={field.value || ""}
                                                onChange={field.onChange}
                                                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                                                disabled={
                                                    isSubmitting || isLoading
                                                }
                                                rows={6}
                                                dropLabel="Drop private key file here"
                                                acceptedExtensions={[
                                                    ".key",
                                                    ".pem",
                                                    ".txt",
                                                ]}
                                                className="font-mono text-xs"
                                            />
                                        )}
                                    />
                                    {errors.private_key_pem && (
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                            {errors.private_key_pem.message}
                                        </p>
                                    )}
                                </div>

                                {/* Note */}
                                <div className="space-y-2">
                                    <Label htmlFor="note">Note</Label>
                                    <Textarea
                                        id="note"
                                        placeholder="Add notes for this certificate..."
                                        disabled={isSubmitting || isLoading}
                                        rows={3}
                                        {...register("note")}
                                    />
                                </div>

                                {/* Info */}
                                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg">
                                    <p className="text-xs text-blue-800 dark:text-blue-200">
                                        💡 <strong>PEM Format:</strong> Copy and
                                        paste the entire certificate and key
                                        blocks, including the BEGIN and END
                                        lines.
                                    </p>
                                </div>

                                {/* Buttons */}
                                <div className="flex gap-3 pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => navigate("/")}
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
                                            ? "Validating..."
                                            : "Continue"}
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
