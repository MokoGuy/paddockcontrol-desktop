import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSetup } from "@/hooks/useSetup";
import { useAppStore } from "@/stores/useAppStore";
import { api } from "@/lib/api";
import { backupKeySchema, type BackupKeyInput } from "@/lib/validation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { FileDropZone } from "@/components/shared/FileDropZone";

import { BackupData } from "@/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    EyeIcon,
    ViewOffIcon,
    Copy01Icon,
    Tick02Icon,
    Package01Icon,
    Certificate02Icon,
} from "@hugeicons/core-free-icons";

export function RestoreBackup() {
    const navigate = useNavigate();
    const {
        setIsSetupComplete,
        setIsWaitingForEncryptionKey,
        setIsEncryptionKeyProvided,
    } = useAppStore();
    const { isLoading, error, validateBackupKey, restoreFromBackup } =
        useSetup();
    const [step, setStep] = useState<"file" | "key" | "confirm">("file");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [backupData, setBackupData] = useState<BackupData | null>(null);
    const [hasEmbeddedKey, setHasEmbeddedKey] = useState(false);
    const [userProvidedKey, setUserProvidedKey] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [keyCopied, setKeyCopied] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<BackupKeyInput>({
        resolver: zodResolver(backupKeySchema),
    });

    const handleFileSelect = async (file: File) => {
        try {
            console.log("📁 Selected backup file:", file.name);
            console.log("📊 File size:", (file.size / 1024).toFixed(2), "KB");

            const content = await file.text();
            console.log("📄 File content read successfully");

            const data = JSON.parse(content);
            console.log("✅ JSON parsed successfully");
            console.log("Backup structure:", {
                version: data.version,
                exportDate: data.export_date,
                hasConfig: !!data.config,
                certificateCount: data.certificates?.length || 0,
                hasEncryptionKey: !!data.encryption_key,
            });

            setBackupData(data);
            setSelectedFile(file);

            // Check if backup has embedded encryption key
            if (data.encryption_key) {
                console.log("🔑 Backup has embedded encryption key");
                setHasEmbeddedKey(true);
            } else {
                console.log(
                    "🔓 Backup requires user to provide encryption key",
                );
                setHasEmbeddedKey(false);
            }
            // Always go to key step
            setStep("key");
        } catch (err) {
            const errorMsg =
                err instanceof Error ? err.message : "Unknown error";
            console.error("❌ Failed to parse backup file:", {
                error: err,
                fileName: file.name,
                fileSize: file.size,
            });
            alert(`Invalid backup file format:\n${errorMsg}`);
        }
    };

    const handleKeySubmit = async (data: BackupKeyInput) => {
        if (!backupData) return;

        try {
            console.log("🔐 Validating backup encryption key...");
            await validateBackupKey(backupData, data.key);
            console.log("✅ Encryption key validated successfully");
            // Store the user-provided key for later use during restore
            setUserProvidedKey(data.key);
            setStep("confirm");
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to validate backup key";
            console.error("❌ Encryption key validation failed:", {
                error: err,
                message,
            });
            alert(`Encryption key validation failed:\n${message}`);
            reset();
        }
    };

    const handleRestore = async () => {
        if (!backupData) return;

        try {
            console.log("🔄 Starting backup restoration...");
            console.log("Backup data:", {
                version: backupData.version,
                certificateCount: backupData.certificates?.length || 0,
                hasConfig: !!backupData.config,
                hasEncryptionKey: !!backupData.encryption_key,
            });

            // Get the encryption key (either embedded or user-provided)
            const keyToUse = backupData.encryption_key || userProvidedKey;

            if (!keyToUse) {
                throw new Error(
                    "No encryption key available for backup restoration",
                );
            }

            // Provide encryption key to backend before restore
            console.log("🔐 Providing encryption key to backend...");
            await api.provideEncryptionKey(keyToUse);
            setIsEncryptionKeyProvided(true);
            console.log("✅ Encryption key provided to backend");

            console.log("📦 Calling restoreFromBackup API...");
            await restoreFromBackup(backupData);

            console.log("✅ Backup restoration successful!");
            console.log("🚀 Updating frontend state...");

            // Update frontend state to reflect successful restore
            setIsSetupComplete(true);
            setIsWaitingForEncryptionKey(false); // We provided the key during restore

            console.log("🚀 Waiting for backend state sync...");
            // Wait to ensure backend has fully processed the restore
            await new Promise((resolve) => setTimeout(resolve, 1000));

            console.log("🚀 Navigating to dashboard...");
            navigate("/", { replace: true });
            console.log("✅ Navigation complete");
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Failed to restore backup";
            console.error("❌ Backup restoration failed:", {
                error: err,
                message,
            });
            alert(message);
        }
    };

    const handleBack = () => {
        if (step === "file") {
            navigate("/setup", { replace: true });
        } else if (step === "key") {
            setBackupData(null);
            setSelectedFile(null);
            setUserProvidedKey(null);
            setStep("file");
        } else {
            // Going back from confirm to either key or file
            if (hasEmbeddedKey) {
                setBackupData(null);
                setSelectedFile(null);
                setHasEmbeddedKey(false);
                setUserProvidedKey(null);
                setStep("file");
            } else {
                setUserProvidedKey(null);
                setStep("key");
            }
        }
    };

    const handleCopyEncryptionKey = async () => {
        const keyToCopy = backupData?.encryption_key || userProvidedKey;
        if (!keyToCopy) return;

        try {
            await api.copyToClipboard(keyToCopy);
            setKeyCopied(true);
            setTimeout(() => setKeyCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy encryption key:", err);
        }
    };

    return (
        <>
            {/* Page Header */}
            <div className="text-center mb-8 space-y-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Restore from Backup
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Restore your configuration and certificates from a backup
                    file
                </p>
            </div>

            <Card className="shadow-sm border-gray-200 dark:border-gray-800">
                {/* Step Indicator */}
                <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
                    <div className="flex items-center gap-2 text-sm">
                        {/* Step 1: Select File */}
                        <div
                            className={`flex items-center justify-center w-6 h-6 rounded-full font-semibold ${
                                step === "file" ||
                                step === "key" ||
                                step === "confirm"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                            }`}
                        >
                            {step === "key" || step === "confirm" ? "✓" : "1"}
                        </div>
                        <span
                            className={
                                step === "file"
                                    ? "font-semibold text-gray-900 dark:text-white"
                                    : "text-gray-600 dark:text-gray-400"
                            }
                        >
                            Select File
                        </span>
                        <div className="flex-1 h-0.5 mx-2 bg-gray-200 dark:bg-gray-700" />

                        {/* Step 2: Encryption Key */}
                        <div
                            className={`flex items-center justify-center w-6 h-6 rounded-full font-semibold ${
                                step === "key" || step === "confirm"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                            }`}
                        >
                            {step === "confirm" ? "✓" : "2"}
                        </div>
                        <span
                            className={
                                step === "key"
                                    ? "font-semibold text-gray-900 dark:text-white"
                                    : "text-gray-600 dark:text-gray-400"
                            }
                        >
                            Encryption Key
                        </span>
                        <div className="flex-1 h-0.5 mx-2 bg-gray-200 dark:bg-gray-700" />

                        {/* Step 3: Confirm */}
                        <div
                            className={`flex items-center justify-center w-6 h-6 rounded-full font-semibold ${
                                step === "confirm"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                            }`}
                        >
                            3
                        </div>
                        <span
                            className={
                                step === "confirm"
                                    ? "font-semibold text-gray-900 dark:text-white"
                                    : "text-gray-600 dark:text-gray-400"
                            }
                        >
                            Confirm
                        </span>
                    </div>
                </div>

                <CardContent>
                    {/* Step 1: File Selection */}
                    {step === "file" && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label>Select Backup File</Label>
                                <FileDropZone
                                    onFileSelect={handleFileSelect}
                                    accept=".json"
                                    acceptedExtensions={[".json"]}
                                    label="Click to select or drag and drop"
                                    sublabel="JSON backup file (.json)"
                                    dropLabel="Drop backup file here"
                                    icon={
                                        <HugeiconsIcon
                                            icon={Package01Icon}
                                            className="w-8 h-8 text-gray-400"
                                            strokeWidth={1.5}
                                        />
                                    }
                                    selectedFile={selectedFile}
                                />
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleBack}
                                className="w-full"
                            >
                                Back
                            </Button>
                        </div>
                    )}

                    {/* Step 2: Encryption Key */}
                    {step === "key" &&
                        backupData &&
                        (hasEmbeddedKey ? (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="embedded-key">
                                        Encryption Key
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="embedded-key"
                                            type={
                                                showPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            value={
                                                backupData.encryption_key || ""
                                            }
                                            disabled
                                            className="pr-20 font-mono"
                                        />
                                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-xs"
                                                onClick={() =>
                                                    setShowPassword(
                                                        !showPassword,
                                                    )
                                                }
                                                title={
                                                    showPassword
                                                        ? "Hide key"
                                                        : "Show key"
                                                }
                                            >
                                                <HugeiconsIcon
                                                    icon={
                                                        showPassword
                                                            ? ViewOffIcon
                                                            : EyeIcon
                                                    }
                                                    className="w-4 h-4"
                                                    strokeWidth={2}
                                                />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-xs"
                                                onClick={
                                                    handleCopyEncryptionKey
                                                }
                                                title="Copy to clipboard"
                                            >
                                                <HugeiconsIcon
                                                    icon={
                                                        keyCopied
                                                            ? Tick02Icon
                                                            : Copy01Icon
                                                    }
                                                    className={`w-4 h-4 ${keyCopied ? "text-green-500" : ""}`}
                                                    strokeWidth={2}
                                                />
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Key included in backup file
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleBack}
                                        className="flex-1"
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => setStep("confirm")}
                                        className="flex-1"
                                    >
                                        Continue
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <form
                                onSubmit={handleSubmit(handleKeySubmit)}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <Label htmlFor="key">Encryption Key</Label>
                                    <div className="relative">
                                        <Input
                                            id="key"
                                            type={
                                                showPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            placeholder="Enter the backup encryption key"
                                            disabled={isLoading}
                                            {...register("key")}
                                            className="pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-xs"
                                            onClick={() =>
                                                setShowPassword(!showPassword)
                                            }
                                            className="absolute right-3 top-1/2 -translate-y-1/2"
                                        >
                                            <HugeiconsIcon
                                                icon={
                                                    showPassword
                                                        ? ViewOffIcon
                                                        : EyeIcon
                                                }
                                                className="w-4 h-4"
                                                strokeWidth={2}
                                            />
                                        </Button>
                                    </div>
                                    {errors.key && (
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                            {errors.key.message}
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleBack}
                                        disabled={isLoading}
                                        className="flex-1"
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={isLoading}
                                        className="flex-1"
                                    >
                                        {isLoading
                                            ? "Validating..."
                                            : "Continue"}
                                    </Button>
                                </div>
                            </form>
                        ))}

                    {/* Step 3: Confirmation */}
                    {step === "confirm" && backupData && (
                        <div className="space-y-6">
                            {/* Version Badge */}
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    Backup Version
                                </span>
                                <Badge variant="secondary">
                                    {backupData.version}
                                </Badge>
                            </div>

                            {/* Certificate List */}
                            <div className="space-y-3">
                                <Label className="flex items-center gap-1.5">
                                    <HugeiconsIcon
                                        icon={Certificate02Icon}
                                        className="w-4 h-4"
                                        strokeWidth={2}
                                    />
                                    Certificates to Import (
                                    {backupData.certificates?.length || 0})
                                </Label>
                                {backupData.certificates &&
                                backupData.certificates.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Hostname</TableHead>
                                                <TableHead className="text-right">
                                                    Includes
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {backupData.certificates.map(
                                                (cert) => (
                                                    <TableRow
                                                        key={cert.hostname}
                                                    >
                                                        <TableCell>
                                                            <Badge
                                                                variant="secondary"
                                                                className="font-mono"
                                                            >
                                                                {cert.hostname}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                {cert.certificate_pem && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-xs px-1.5 py-0"
                                                                    >
                                                                        cert
                                                                    </Badge>
                                                                )}
                                                                {cert.pending_csr_pem && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-xs px-1.5 py-0"
                                                                    >
                                                                        pending
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ),
                                            )}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="px-3 py-4 text-sm text-muted-foreground text-center border border-border rounded-lg">
                                        No certificates in backup
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleBack}
                                    disabled={isLoading}
                                    className="flex-1"
                                >
                                    Back
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => {
                                        console.log(
                                            "🚀 Restore button clicked",
                                        );
                                        handleRestore();
                                    }}
                                    disabled={isLoading}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                    {isLoading ? "Restoring..." : "Restore Now"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900">
                            <CardContent className="p-4">
                                <p className="text-sm text-red-800 dark:text-red-200">
                                    {error}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Loading State */}
                    {isLoading && step !== "file" && (
                        <div className="flex items-center justify-center py-8">
                            <LoadingSpinner text="Processing..." />
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
