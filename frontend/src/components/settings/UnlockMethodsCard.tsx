import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminGatedButton } from "@/components/shared/AdminGatedButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useSecurityKeys } from "@/hooks/useSecurityKeys";
import { SecurityKeyInfo } from "@/types";

interface UnlockMethodsCardProps {
    onChangePassword: () => void;
    className?: string;
}

function MethodRow({
    title,
    description,
    badge,
    action,
}: {
    title: string;
    description: React.ReactNode;
    badge?: React.ReactNode;
    action: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-3 border border-border px-3 py-2.5">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                        {title}
                    </p>
                    {badge}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {description}
                </p>
            </div>
            <div className="shrink-0">{action}</div>
        </div>
    );
}

export function UnlockMethodsCard({
    onChangePassword,
    className,
}: UnlockMethodsCardProps) {
    const {
        methods,
        webAuthnAvailable,
        refresh,
        enrollWindowsHello,
        enrollSecurityKey,
        remove,
    } = useSecurityKeys();

    const [removeTarget, setRemoveTarget] = useState<SecurityKeyInfo | null>(
        null,
    );
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const run = async (fn: () => Promise<void>, ok: string) => {
        setBusy(true);
        try {
            await fn();
            toast.success(ok);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Operation failed");
        } finally {
            setBusy(false);
        }
    };

    // Each passkey kind is a separate enrollment path so Windows shows a single,
    // unambiguous prompt. The label (set by the backend) identifies the row.
    const passkeyRow = (
        title: string,
        description: string,
        label: string,
        enroll: () => Promise<void>,
    ) => {
        const key = methods.find(
            (m) => m.method === "fido2" && m.label === label,
        );
        return (
            <MethodRow
                title={title}
                description={description}
                badge={
                    key ? (
                        <Badge
                            variant="outline"
                            className="border-success/40 bg-success/10 text-success"
                        >
                            Enabled
                        </Badge>
                    ) : undefined
                }
                action={
                    key ? (
                        <AdminGatedButton
                            variant="outline"
                            size="sm"
                            requireAdminMode={false}
                            requireUnlocked
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setRemoveTarget(key)}
                            disabled={busy}
                        >
                            Remove
                        </AdminGatedButton>
                    ) : (
                        <AdminGatedButton
                            variant="outline"
                            size="sm"
                            requireAdminMode={false}
                            requireUnlocked
                            onClick={() => run(enroll, `${title} enrolled`)}
                            disabled={busy}
                        >
                            {busy ? "Waiting…" : "Enable"}
                        </AdminGatedButton>
                    )
                }
            />
        );
    };

    return (
        <>
            <Card className={`shadow-sm border-border ${className ?? ""}`}>
                <CardHeader>
                    <CardTitle>Unlock methods</CardTitle>
                    <CardDescription>
                        How this app is unlocked. Your password is always kept as
                        the recovery method.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {/* Password — permanent root */}
                    <MethodRow
                        title="Password"
                        description="Required — your recovery method"
                        badge={
                            <Badge
                                variant="outline"
                                className="border-info/40 bg-info/10 text-info"
                            >
                                Required
                            </Badge>
                        }
                        action={
                            <AdminGatedButton
                                variant="outline"
                                size="sm"
                                requireAdminMode={false}
                                requireUnlocked
                                onClick={onChangePassword}
                            >
                                Change
                            </AdminGatedButton>
                        }
                    />

                    {/* Passkeys — one constrained enrollment path each */}
                    {webAuthnAvailable && (
                        <>
                            {passkeyRow(
                                "Windows Hello",
                                "Unlock with your fingerprint or PIN on this device",
                                "Windows Hello",
                                enrollWindowsHello,
                            )}
                            {passkeyRow(
                                "Security key",
                                "Unlock by tapping a FIDO2 security key",
                                "Security key",
                                enrollSecurityKey,
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Remove a method */}
            <ConfirmDialog
                open={removeTarget !== null}
                title="Remove unlock method"
                description={`This removes "${removeTarget?.label ?? ""}" as an unlock method. Your password still works.`}
                confirmText="Remove"
                cancelText="Cancel"
                isDestructive
                isLoading={busy}
                onConfirm={async () => {
                    const id = removeTarget?.id;
                    if (id !== undefined) {
                        await run(() => remove(id), "Unlock method removed");
                    }
                    setRemoveTarget(null);
                }}
                onCancel={() => setRemoveTarget(null)}
            />
        </>
    );
}
