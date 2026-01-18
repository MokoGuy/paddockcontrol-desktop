import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon } from "@hugeicons/core-free-icons";

interface CertificatePEMSectionProps {
    hostname: string;
    certificatePEM: string;
}

export function CertificatePEMSection({
    hostname,
    certificatePEM,
}: CertificatePEMSectionProps) {
    const handleDownload = () => {
        const link = document.createElement("a");
        link.href =
            "data:text/plain;charset=utf-8," +
            encodeURIComponent(certificatePEM);
        link.download = `${hostname}.crt`;
        link.click();
    };

    return (
        <Card className="mb-6 shadow-sm border-border">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Certificate (PEM)</CardTitle>
                        <CardDescription>
                            X.509 certificate in PEM format
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownload}
                    >
                        <HugeiconsIcon
                            icon={Download04Icon}
                            className="w-4 h-4 mr-1"
                            strokeWidth={2}
                        />
                        Download
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <CodeBlock content={certificatePEM} />
            </CardContent>
        </Card>
    );
}
