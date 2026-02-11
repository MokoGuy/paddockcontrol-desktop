import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/theme";
import type { Certificate } from "@/types";

interface CertificateStatusSectionProps {
    certificate: Certificate;
    variant?: "active" | "pending";
}

export function CertificateStatusSection({ certificate, variant = "active" }: CertificateStatusSectionProps) {
    const isPending = variant === "pending";
    const keySize = isPending ? certificate.pending_key_size : certificate.key_size;

    return (
        <Card className="mb-6 shadow-sm border-border">
            <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>
                    {isPending ? "Pending CSR details" : "Current certificate status"}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase">
                            Created
                        </p>
                        <p className="text-sm font-semibold text-foreground">
                            {formatDateTime(certificate.created_at)}
                        </p>
                    </div>
                    {!isPending && certificate.expires_at && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                Expires
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                                {formatDateTime(certificate.expires_at)}
                            </p>
                        </div>
                    )}
                    {keySize && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                Key Size
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                                {keySize} bits
                            </p>
                        </div>
                    )}
                    {!isPending && certificate.days_until_expiration !== undefined && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                Days Until Expiration
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                                {certificate.days_until_expiration} days
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
