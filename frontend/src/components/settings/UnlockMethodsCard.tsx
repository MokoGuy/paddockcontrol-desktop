import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useSecurityKeys } from "@/hooks/useSecurityKeys";
import { SecurityKeyInfo } from "@/types";

interface UnlockMethodsCardProps {
    isUnlocked: boolean;
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
    isUnlocked,
    onChangePassword,
    className,
}: UnlockMethodsCardProps) {
    const { methods, webAuthnAvailable, refresh, enrollWebAuthn, remove } =
        useSecurityKeys();

    const [removeTarget, setRemoveTarget] = useState<SecurityKeyInfo | null>(
        null,
    );
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const passkey = methods.find((m) => m.method === "fido2");

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

    const lockedHint = !isUnlocked ? "Unlock the app first" : undefined;

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
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onChangePassword}
                                disabled={!isUnlocked}
                                title={lockedHint}
                            >
                                Change
                            </Button>
                        }
                    />

                    {/* Passkey — Windows Hello / security key */}
                    {(passkey || webAuthnAvailable) && (
                        <MethodRow
                            title="Passkey (Windows Hello / security key)"
                            description={
                                passkey
                                    ? "Unlock with your fingerprint, PIN, or a security key"
                                    : "Add a tap-to-unlock passkey backed by hardware"
                            }
                            badge={
                                passkey ? (
                                    <Badge
                                        variant="outline"
                                        className="border-success/40 bg-success/10 text-success"
                                    >
                                        Enabled
                                    </Badge>
                                ) : undefined
                            }
                            action={
                                passkey ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={() => setRemoveTarget(passkey)}
                                        disabled={busy}
                                    >
                                        Remove
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            run(
                                                () => enrollWebAuthn("Passkey"),
                                                "Passkey enrolled",
                                            )
                                        }
                                        disabled={!isUnlocked || busy}
                                        title={lockedHint}
                                    >
                                        {busy ? "Waiting…" : "Enable"}
                                    </Button>
                                )
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
