import { motion, AnimatePresence } from "motion/react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/certificate/StatusBadge";
import { ReadOnlyBadge } from "@/components/certificate/ReadOnlyBadge";
import { formatDateTime } from "@/lib/theme";
import type { Certificate } from "@/types";

interface CertificateStatusSectionProps {
    certificate: Certificate;
}

export function CertificateStatusSection({ certificate }: CertificateStatusSectionProps) {
    return (
        <Card className="mb-6 shadow-sm border-border">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Status</CardTitle>
                        <CardDescription>
                            Current certificate status
                        </CardDescription>
                    </div>
                    <motion.div className="flex items-center gap-2" layout>
                        <motion.div layout transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
                            <StatusBadge
                                status={certificate.status}
                                daysUntilExpiration={certificate.days_until_expiration}
                            />
                        </motion.div>
                        <AnimatePresence mode="popLayout">
                            {certificate.read_only && (
                                <motion.div
                                    key="read-only-badge"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 500,
                                        damping: 30,
                                    }}
                                >
                                    <ReadOnlyBadge />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
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
                    {certificate.expires_at && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                Expires
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                                {formatDateTime(certificate.expires_at)}
                            </p>
                        </div>
                    )}
                    {certificate.key_size && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                Key Size
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                                {certificate.key_size} bits
                            </p>
                        </div>
                    )}
                    {certificate.days_until_expiration !== undefined && (
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
