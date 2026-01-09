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
            <>
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">
                            Confirm Import
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Review the certificate before importing
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

                <Card className="mb-6 shadow-sm border-border">
                    <CardHeader>
                        <CardTitle>Certificate Preview</CardTitle>
                        <CardDescription>
                            Certificate in PEM format
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-muted text-foreground p-4 rounded-lg text-xs overflow-auto max-h-48 border border-border scrollbar-float">
                            {certificatePem.substring(0, 500)}...
                        </pre>
                    </CardContent>
                </Card>

                <Card className="mb-6 shadow-sm border-border">
                    <CardHeader>
                        <CardTitle>Private Key Preview</CardTitle>
                        <CardDescription>
                            Private key in PEM format
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-muted text-foreground p-4 rounded-lg text-xs overflow-auto max-h-48 border border-border scrollbar-float">
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
                        Back to Form
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
            </>
        );
    }

    return (
        <>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">
                        Import Certificate
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Import an existing SSL/TLS certificate with its private
                        key
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
                <Card className="mb-6 bg-destructive/10 border-destructive/30">
                    <CardContent>
                        <p className="text-sm text-destructive">
                            {error}
                        </p>
                    </CardContent>
                </Card>
            )}

            <Card className="shadow-sm border-border">
                <CardHeader>
                    <CardTitle>Certificate Details</CardTitle>
                    <CardDescription>
                        Provide your certificate and private key in PEM format
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={handleSubmit(() => setStep("confirm"))}
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
                                        disabled={isSubmitting || isLoading}
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
                                <p className="text-sm text-destructive">
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
                                        disabled={isSubmitting || isLoading}
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
                                <p className="text-sm text-destructive">
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
                        <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                            <p className="text-xs text-primary">
                                💡 <strong>PEM Format:</strong> Copy and paste
                                the entire certificate and key blocks, including
                                the BEGIN and END lines.
                            </p>
                        </div>

                        {/* Buttons */}
                        <div className="pt-4">
                            <Button
                                type="submit"
                                disabled={isSubmitting || isLoading}
                                className="w-full"
                            >
                                {isSubmitting || isLoading
                                    ? "Validating..."
                                    : "Continue"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </>
    );
}
