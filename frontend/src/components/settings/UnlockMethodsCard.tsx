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
    const { methods, webAuthnAvailable, refresh, enrollPasskey, remove } =
        useSecurityKeys();

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
            // Wails rejects bound-method errors with a string, not an Error.
            const message =
                typeof err === "string"
                    ? err
                    : err instanceof Error
                      ? err.message
                      : "Operation failed";
            toast.error(message);
        } finally {
            setBusy(false);
        }
    };

    const passkeys = methods.filter((m) => m.method === "fido2");

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

                    {/* Enrolled passkeys (Windows Hello / security key / phone) */}
                    {passkeys.map((key, i) => (
                        <MethodRow
                            key={key.id}
                            title={`Passkey #${i + 1}`}
                            description={
                                <>
                                    Type: {key.label}
                                    {key.label === "Windows Hello" && (
                                        <span className="text-warning">
                                            {" "}
                                            · only one per device
                                        </span>
                                    )}
                                </>
                            }
                            badge={
                                <Badge
                                    variant="outline"
                                    className="border-success/40 bg-success/10 text-success"
                                >
                                    Enabled
                                </Badge>
                            }
                            action={
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
                            }
                        />
                    ))}

                    {/* Add a passkey — the OS dialog offers Windows Hello, a
                        security key, or a phone */}
                    {webAuthnAvailable && (
                        <MethodRow
                            title="Passkey"
                            description="Windows Hello, a security key, or your phone"
                            action={
                                <AdminGatedButton
                                    variant="outline"
                                    size="sm"
                                    requireAdminMode={false}
                                    requireUnlocked
                                    onClick={() =>
                                        run(enrollPasskey, "Passkey enrolled")
                                    }
                                    disabled={busy}
                                >
                                    {busy ? "Waiting…" : "Add"}
                                </AdminGatedButton>
                            }
                        />
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
