import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";

interface CertificatePEMSectionProps {
    hostname: string;
    certificatePEM: string;
}

export function CertificatePEMSection({
    hostname,
    certificatePEM,
}: CertificatePEMSectionProps) {
    return (
        <Card className="mb-6 shadow-sm border-border">
            <CardHeader>
                <CardTitle>Certificate (PEM)</CardTitle>
                <CardDescription>
                    X.509 certificate in PEM format
                </CardDescription>
            </CardHeader>
            <CardContent>
                <CodeBlock
                    content={certificatePEM}
                    downloadFilename={`${hostname}.crt`}
                />
            </CardContent>
        </Card>
    );
}
