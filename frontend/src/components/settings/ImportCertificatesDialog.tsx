import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusAlert } from "@/components/shared/StatusAlert";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useBackup } from "@/hooks/useBackup";
import { BackupPeekInfo, CertImportResult } from "@/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    AlertCircleIcon,
    EyeIcon,
    ViewOffIcon,
    Tick02Icon,
} from "@hugeicons/core-free-icons";

interface ImportCertificatesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: () => void;
}

type Step = "select" | "preview" | "password" | "result";

export function ImportCertificatesDialog({
    open,
    onOpenChange,
    onComplete,
}: ImportCertificatesDialogProps) {
    const { selectBackupFile, peekBackupInfo, importCertificatesFromBackup, isLoading } = useBackup();
    const [step, setStep] = useState<Step>("select");
    const [backupPath, setBackupPath] = useState<string | null>(null);
    const [peekInfo, setPeekInfo] = useState<BackupPeekInfo | null>(null);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [result, setResult] = useState<CertImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const reset = () => {
        setStep("select");
        setBackupPath(null);
        setPeekInfo(null);
        setPassword("");
        setShowPassword(false);
        setResult(null);
        setError(null);
        setIsProcessing(false);
    };

    const handleClose = () => {
        if (result) {
            onComplete();
        }
        reset();
        onOpenChange(false);
    };

    const handleSelectFile = async () => {
        setError(null);
        const path = await selectBackupFile();
        if (!path) return;

        setBackupPath(path);
        setIsProcessing(true);
        const info = await peekBackupInfo(path);
        setIsProcessing(false);

        if (!info) {
            setError("Failed to read backup file. Make sure it is a valid database backup.");
            return;
        }

        setPeekInfo(info);
        if (info.has_security_keys) {
            setStep("preview");
        } else {
            setError("This backup has no security keys. Cannot import certificates without encrypted data.");
        }
    };

    const handleImport = async () => {
        if (!backupPath || !password) return;

        setError(null);
        setIsProcessing(true);
        const importResult = await importCertificatesFromBackup(backupPath, password);
        setIsProcessing(false);

        if (!importResult) {
            setError("Import failed. Check your password and try again.");
            return;
        }

        setResult(importResult);
        setStep("result");
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {step === "result" ? "Import Complete" : "Import Certificates"}
                    </DialogTitle>
                    <DialogDescription>
                        {step === "select" && "Select a database backup file to import certificates from."}
                        {step === "preview" && "Review the backup contents before importing."}
                        {step === "password" && "Enter the backup's password to decrypt certificates."}
                        {step === "result" && "Certificates have been imported."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Step: Select File */}
                    {step === "select" && (
                        <div className="space-y-4">
                            <Button
                                onClick={handleSelectFile}
                                disabled={isProcessing || isLoading}
                                className="w-full"
                            >
                                {isProcessing ? "Reading backup..." : "Select Backup File (.db)"}
                            </Button>
                        </div>
                    )}

                    {/* Step: Preview */}
                    {step === "preview" && peekInfo && (
                        <div className="space-y-4">
                            <div className="border border-border p-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Certificates</span>
                                    <span className="font-medium">{peekInfo.certificate_count}</span>
                                </div>
                                {peekInfo.ca_name && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">CA Name</span>
                                        <span className="font-medium">{peekInfo.ca_name}</span>
                                    </div>
                                )}
                            </div>

                            {peekInfo.hostnames.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Hostnames</Label>
                                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                                        {peekInfo.hostnames.map((hostname) => (
                                            <Badge
                                                key={hostname}
                                                variant="secondary"
                                                className="font-mono text-xs"
                                            >
                                                {hostname}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={reset}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => setStep("password")}
                                    className="flex-1"
                                >
                                    Continue
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step: Password */}
                    {step === "password" && (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleImport();
                            }}
                            className="space-y-4"
                        >
                            <div className="space-y-2">
                                <Label htmlFor="backup-password">Backup Password</Label>
                                <div className="relative">
                                    <Input
                                        id="backup-password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter the backup's unlock password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={isProcessing}
                                        className="pr-10"
                                        autoFocus
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2"
                                    >
                                        <HugeiconsIcon
                                            icon={showPassword ? ViewOffIcon : EyeIcon}
                                            className="w-4 h-4"
                                            strokeWidth={2}
                                        />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    The password used to unlock this backup
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setStep("preview")}
                                    disabled={isProcessing}
                                    className="flex-1"
                                >
                                    Back
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isProcessing || !password}
                                    className="flex-1"
                                >
                                    {isProcessing ? "Importing..." : "Import"}
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* Step: Result */}
                    {step === "result" && result && (
                        <div className="space-y-4">
                            <div className="border border-border p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <HugeiconsIcon
                                        icon={Tick02Icon}
                                        className="size-5 text-success"
                                        strokeWidth={2}
                                    />
                                    <span className="font-medium">
                                        {result.imported} certificate{result.imported !== 1 ? "s" : ""} imported
                                    </span>
                                </div>

                                {result.skipped > 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        {result.skipped} skipped (already exist)
                                    </p>
                                )}

                                {result.conflicts && result.conflicts.length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">Skipped hostnames:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {result.conflicts.map((hostname) => (
                                                <Badge
                                                    key={hostname}
                                                    variant="outline"
                                                    className="font-mono text-xs"
                                                >
                                                    {hostname}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button onClick={handleClose} className="w-full">
                                Done
                            </Button>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
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
                            {error}
                        </StatusAlert>
                    )}

                    {/* Loading */}
                    {isProcessing && step !== "select" && (
                        <div className="flex items-center justify-center py-2">
                            <LoadingSpinner text="Processing..." />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
