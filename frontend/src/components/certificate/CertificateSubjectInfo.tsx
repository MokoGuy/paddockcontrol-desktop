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
}

export function CertificateSubjectInfo({ certificate }: CertificateSubjectInfoProps) {
    return (
        <Card className="mb-6 shadow-sm border-border">
            <CardHeader>
                <CardTitle>Subject Information</CardTitle>
                <CardDescription>
                    Certificate subject details
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    {certificate.organization && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                Organization
                            </p>
                            <p className="text-sm text-foreground">
                                {certificate.organization}
                            </p>
                        </div>
                    )}
                    {certificate.organizational_unit && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                Organizational Unit
                            </p>
                            <p className="text-sm text-foreground">
                                {certificate.organizational_unit}
                            </p>
                        </div>
                    )}
                    {certificate.city && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                City
                            </p>
                            <p className="text-sm text-foreground">
                                {certificate.city}
                            </p>
                        </div>
                    )}
                    {certificate.state && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                State
                            </p>
                            <p className="text-sm text-foreground">
                                {certificate.state}
                            </p>
                        </div>
                    )}
                    {certificate.country && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                Country
                            </p>
                            <p className="text-sm text-foreground">
                                {certificate.country}
                            </p>
                        </div>
                    )}
                </div>

                {certificate.sans && certificate.sans.length > 0 && (
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                            Subject Alternative Names
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {certificate.sans.map((san) => (
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
