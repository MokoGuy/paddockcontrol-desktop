import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Certificate } from "@/types";

interface CertificateSubjectInfoProps {
    certificate: Certificate;
    variant?: "active" | "pending";
}

export function CertificateSubjectInfo({ certificate, variant = "active" }: CertificateSubjectInfoProps) {
    const isPending = variant === "pending";
    const organization = isPending ? certificate.pending_organization : certificate.organization;
    const organizationalUnit = isPending ? certificate.pending_organizational_unit : certificate.organizational_unit;
    const city = isPending ? certificate.pending_city : certificate.city;
    const state = isPending ? certificate.pending_state : certificate.state;
    const country = isPending ? certificate.pending_country : certificate.country;
    const sans = isPending ? certificate.pending_sans : certificate.sans;

    return (
        <Card className="mb-6 shadow-sm border-border">
            <CardHeader>
                <CardTitle>Subject Information</CardTitle>
                <CardDescription>
                    {isPending ? "Pending CSR subject details" : "Certificate subject details"}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    {organization && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                Organization
                            </p>
                            <p className="text-sm text-foreground">
                                {organization}
                            </p>
                        </div>
                    )}
                    {organizationalUnit && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                Organizational Unit
                            </p>
                            <p className="text-sm text-foreground">
                                {organizationalUnit}
                            </p>
                        </div>
                    )}
                    {city && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                City
                            </p>
                            <p className="text-sm text-foreground">
                                {city}
                            </p>
                        </div>
                    )}
                    {state && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                State
                            </p>
                            <p className="text-sm text-foreground">
                                {state}
                            </p>
                        </div>
                    )}
                    {country && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                Country
                            </p>
                            <p className="text-sm text-foreground">
                                {country}
                            </p>
                        </div>
                    )}
                </div>

                {sans && sans.length > 0 && (
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                            Subject Alternative Names
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {sans.map((san) => (
                                <Badge key={san} variant="secondary">
                                    {san}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
