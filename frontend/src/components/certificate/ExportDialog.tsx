import { useState, useCallback, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { StatusAlert } from "@/components/shared/StatusAlert";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { api } from "@/lib/api";
import type { Certificate } from "@/types";

interface ExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    certificate: Certificate;
    isUnlocked: boolean;
}

interface ExportItem {
    key: string;
    label: string;
    filename: string;
    requiresKey: boolean;
    group: "certificate" | "pending";
}

export function ExportDialog({
    open,
    onOpenChange,
    certificate,
    isUnlocked,
}: ExportDialogProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    const hostname = certificate.hostname;

    // Build available items based on certificate state
    const items = useMemo(() => {
        const result: ExportItem[] = [];

        if (certificate.certificate_pem) {
            result.push({
                key: "certificate",
                label: "Certificate (Leaf)",
                filename: `${hostname}.crt`,
                requiresKey: false,
                group: "certificate",
            });
            result.push({
                key: "chain",
                label: "Certificate Chain (Leaf → Interm. → Root)",
                filename: `${hostname}-chain.crt`,
                requiresKey: false,
                group: "certificate",
            });
            result.push({
                key: "privateKey",
                label: "Private Key",
                filename: `${hostname}.key`,
                requiresKey: true,
                group: "certificate",
            });
        }

        if (certificate.pending_csr) {
            result.push({
                key: "csr",
                label: "CSR",
                filename: `${hostname}.csr`,
                requiresKey: false,
                group: "pending",
            });
            result.push({
                key: "pendingKey",
                label: "Private Key",
                filename: `${hostname}.pending.key`,
                requiresKey: true,
                group: "pending",
            });
        }

        return result;
    }, [certificate, hostname]);

    // Default checked state: all items checked except keys when encryption key not provided
    const defaultChecked = useMemo(() => {
        const checked: Record<string, boolean> = {};
        for (const item of items) {
            checked[item.key] = item.requiresKey ? isUnlocked : true;
        }
        return checked;
    }, [items, isUnlocked]);

    const [checked, setChecked] = useState<Record<string, boolean>>(defaultChecked);

    // Reset state when dialog opens
    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (open) {
                const initial: Record<string, boolean> = {};
                for (const item of items) {
                    initial[item.key] = item.requiresKey ? isUnlocked : true;
                }
                setChecked(initial);
                setExportError(null);
            }
            onOpenChange(open);
        },
        [onOpenChange, items, isUnlocked],
    );

    const toggleItem = useCallback((key: string, value: boolean) => {
        setChecked((prev) => ({ ...prev, [key]: value }));
    }, []);

    const hasSelection = Object.values(checked).some(Boolean);

    const certificateItems = items.filter((i) => i.group === "certificate");
    const pendingItems = items.filter((i) => i.group === "pending");

    const handleExport = useCallback(async () => {
        setIsExporting(true);
        setExportError(null);
        try {
            await api.exportCertificateZip(hostname, {
                certificate: !!checked.certificate,
                chain: !!checked.chain,
                private_key: !!checked.privateKey,
                csr: !!checked.csr,
                pending_key: !!checked.pendingKey,
            });
            onOpenChange(false);
        } catch (err) {
            setExportError(
                err instanceof Error ? err.message : String(err),
            );
        } finally {
            setIsExporting(false);
        }
    }, [hostname, checked, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle>Export Certificate Files</DialogTitle>
                    <DialogDescription>
                        Select which files to include in the ZIP archive.
                    </DialogDescription>
                </DialogHeader>

                {exportError && (
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
                        {exportError}
                    </StatusAlert>
                )}

                <div className="space-y-5">
                    {certificateItems.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-sm font-medium text-muted-foreground">
                                Certificate
                            </p>
                            {certificateItems.map((item) => (
                                <ExportCheckboxItem
                                    key={item.key}
                                    item={item}
                                    checked={!!checked[item.key]}
                                    disabled={
                                        item.requiresKey &&
                                        !isUnlocked
                                    }
                                    onCheckedChange={(val) =>
                                        toggleItem(item.key, val)
                                    }
                                    isUnlocked={
                                        isUnlocked
                                    }
                                />
                            ))}
                        </div>
                    )}

                    {pendingItems.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-sm font-medium text-muted-foreground">
                                Pending
                            </p>
                            {pendingItems.map((item) => (
                                <ExportCheckboxItem
                                    key={item.key}
                                    item={item}
                                    checked={!!checked[item.key]}
                                    disabled={
                                        item.requiresKey &&
                                        !isUnlocked
                                    }
                                    onCheckedChange={(val) =>
                                        toggleItem(item.key, val)
                                    }
                                    isUnlocked={
                                        isUnlocked
                                    }
                                />
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={isExporting || !hasSelection}
                    >
                        {isExporting ? "Exporting..." : "Export"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ExportCheckboxItem({
    item,
    checked,
    disabled,
    onCheckedChange,
    isUnlocked,
}: {
    item: ExportItem;
    checked: boolean;
    disabled: boolean;
    onCheckedChange: (val: boolean) => void;
    isUnlocked: boolean;
}) {
    return (
        <div className="flex items-center gap-3">
            <Checkbox
                id={`export-${item.key}`}
                checked={checked}
                onCheckedChange={(val) => onCheckedChange(val === true)}
                disabled={disabled}
            />
            <div className="flex-1 min-w-0">
                <Label
                    htmlFor={`export-${item.key}`}
                    className={`text-sm cursor-pointer ${disabled ? "text-muted-foreground" : ""}`}
                >
                    {item.label}
                </Label>
                <p className="text-xs text-muted-foreground truncate">
                    {item.requiresKey && !isUnlocked
                        ? "Encryption key required"
                        : item.filename}
                </p>
            </div>
        </div>
    );
}
