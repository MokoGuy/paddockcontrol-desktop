import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { Certificate } from "@/types";

interface CertificateNotesSectionProps {
    certificate: Certificate;
}

export function CertificateNotesSection({ certificate }: CertificateNotesSectionProps) {
    if (!certificate.note && !certificate.pending_note) {
        return null;
    }

    return (
        <Card className="mb-6 shadow-sm border-border">
            <CardHeader>
                <CardTitle>Notes</CardTitle>
                <CardDescription>
                    Additional information
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {certificate.note && (
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                            Note
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {certificate.note}
                        </p>
                    </div>
                )}
                {certificate.pending_note && (
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                            Pending Note
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {certificate.pending_note}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
