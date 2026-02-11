import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCertificates } from "@/hooks/useCertificates";
import { useAppStore } from "@/stores/useAppStore";
import { useCertificateStore } from "@/stores/useCertificateStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { AdminGatedButton } from "@/components/shared/AdminGatedButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { EncryptionKeyDialog } from "@/components/shared/EncryptionKeyDialog";
import { StatusAlert } from "@/components/shared/StatusAlert";
import { LimitedModeNotice } from "@/components/shared/LimitedModeNotice";
import { StatusBadge } from "@/components/certificate/StatusBadge";
import { ReadOnlyBadge } from "@/components/certificate/ReadOnlyBadge";
import { RenewalBadge } from "@/components/certificate/RenewalBadge";
import { formatDate } from "@/lib/theme";
import { CertificateFilter, CertificateListItem } from "@/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Certificate02Icon,
    ArrowRight01Icon,
    Search01Icon,
    AlertCircleIcon,
} from "@hugeicons/core-free-icons";

export function Dashboard() {
    const navigate = useNavigate();
    const { certificates, isLoading, error, listCertificates, setCertificateReadOnly } =
        useCertificates();
    const { isEncryptionKeyProvided } = useAppStore();
    const { updateCertificate } = useCertificateStore();

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<
        "all" | "pending" | "active" | "expiring" | "expired"
    >("all");
    const [sortBy, setSortBy] = useState<"created" | "expiring" | "hostname">(
        "created",
    );
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [showKeyDialog, setShowKeyDialog] = useState(false);
    const [selectedHostname, setSelectedHostname] = useState<string | null>(null);

    // Handle card click with exit animation
    const handleCardClick = (hostname: string) => {
        if (selectedHostname !== null) return; // Prevent double-clicks
        setSelectedHostname(hostname);
        setTimeout(() => {
            navigate(`/certificates/${hostname}`);
        }, 300);
    };

    // Alt + Right Click to toggle read-only state
    const handleContextMenu = useCallback(async (e: React.MouseEvent, cert: CertificateListItem) => {
        if (!e.altKey) return;
        e.preventDefault();

        const newReadOnly = !cert.read_only;
        updateCertificate(cert.hostname, { ...cert, read_only: newReadOnly });

        try {
            await setCertificateReadOnly(cert.hostname, newReadOnly);
            toast.success(newReadOnly ? "Certificate locked" : "Certificate unlocked");
        } catch {
            updateCertificate(cert.hostname, { ...cert, read_only: !newReadOnly });
            toast.error("Failed to update read-only state");
        }
    }, [setCertificateReadOnly, updateCertificate]);

    const loadCertificates = async () => {
        const filter: CertificateFilter = {
            status: statusFilter,
            sort_by: sortBy,
            sort_order: sortOrder,
        };
        await listCertificates(filter);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
    useEffect(() => { loadCertificates(); }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filters change, loadCertificates is stable
    useEffect(() => { loadCertificates(); }, [statusFilter, sortBy, sortOrder]);

    const handleStatusFilterChange = (status: string) => {
        setSelectedHostname(null);
        setStatusFilter(
            status as "all" | "pending" | "active" | "expiring" | "expired",
        );
    };

    const resetFilters = () => {
        setSearchTerm("");
        setStatusFilter("all");
        setSortBy("created");
        setSortOrder("desc");
    };

    const filteredCerts = certificates.filter(
        (cert) =>
            cert.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cert.sans?.some((san) =>
                san.toLowerCase().includes(searchTerm.toLowerCase()),
            ),
    );

    // Animation values
    const isAnimatingOut = selectedHostname !== null;

    return (
        <>
            {/* Animated page content wrapper */}
            <motion.div
                animate={{
                    x: isAnimatingOut ? -40 : 0,
                    opacity: isAnimatingOut ? 0 : 1,
                }}
                transition={{
                    duration: 0.25,
                    ease: [0.4, 0, 0.2, 1],
                }}
                className={isAnimatingOut ? "pointer-events-none" : ""}
            >
                {/* Page Header */}
                <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">
                        Certificates
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your SSL/TLS certificates
                    </p>
                </div>
                <div className="flex gap-2">
                    <AdminGatedButton
                        requireAdminMode={false}
                        requireEncryptionKey
                        onClick={() => navigate("/certificates/generate")}
                    >
                        Generate CSR
                    </AdminGatedButton>
                    <AdminGatedButton
                        variant="outline"
                        requireAdminMode={false}
                        requireEncryptionKey
                        onClick={() => navigate("/certificates/import")}
                    >
                        Import Certificate
                    </AdminGatedButton>
                    <Button
                        variant="outline"
                        onClick={() => navigate("/settings")}
                    >
                        Settings
                    </Button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <StatusAlert
                    variant="destructive"
                    className="mb-6"
                    icon={
                        <HugeiconsIcon
                            icon={AlertCircleIcon}
                            className="size-4"
                            strokeWidth={2}
                        />
                    }
                >
                    {error}
                </StatusAlert>
            )}

            {/* Limited Mode Notice */}
            {!isEncryptionKeyProvided && (
                <LimitedModeNotice
                    className="mb-6"
                    onProvideKey={() => setShowKeyDialog(true)}
                />
            )}

            {/* Filters Card */}
            <Card className="mb-6 shadow-sm border-border">
                <CardContent>
                    <div className="space-y-4">
                        {/* Search */}
                        <InputGroup>
                            <InputGroupAddon>
                                <HugeiconsIcon
                                    icon={Search01Icon}
                                    className="w-4 h-4"
                                    strokeWidth={2}
                                />
                            </InputGroupAddon>
                            <InputGroupInput
                                placeholder="Search by hostname or SAN..."
                                value={searchTerm}
                                onChange={(e) => { setSelectedHostname(null); setSearchTerm(e.target.value); }}
                            />
                        </InputGroup>

                        {/* Filter and Sort Controls */}
                        <div className="flex flex-wrap gap-4 items-center justify-between w-full">
                            {/* Status Filter */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-muted-foreground">
                                    Status
                                </label>
                                <ToggleGroup
                                    type="single"
                                    value={statusFilter}
                                    onValueChange={(value) => {
                                        if (value) handleStatusFilterChange(value);
                                    }}
                                    variant="outline"
                                    size="sm"
                                >
                                    {["all", "pending", "active", "expiring", "expired"].map((status) => (
                                        <ToggleGroupItem key={status} value={status}>
                                            {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>

                            {/* Vertical Separator */}
                            <div className="border-l border-border h-8"></div>

                            {/* Sort Controls */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-muted-foreground">
                                    Sort By
                                </label>
                                <div className="flex gap-2">
                                    <Select
                                        value={sortBy}
                                        onValueChange={(value) =>
                                            setSortBy(
                                                value as
                                                    | "created"
                                                    | "expiring"
                                                    | "hostname",
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            size="sm"
                                            className="w-[120px]"
                                        >
                                            <SelectValue placeholder="Sort by" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="created">
                                                Created
                                            </SelectItem>
                                            <SelectItem value="expiring">
                                                Expiring
                                            </SelectItem>
                                            <SelectItem value="hostname">
                                                Hostname
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setSortOrder(
                                                sortOrder === "asc"
                                                    ? "desc"
                                                    : "asc",
                                            )
                                        }
                                    >
                                        {sortOrder === "asc" ? "↑" : "↓"}
                                    </Button>
                                </div>
                            </div>

                            {/* Vertical Separator */}
                            <div className="border-l border-border h-8"></div>

                            {/* Reset Filters Button */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={resetFilters}
                                className="whitespace-nowrap"
                            >
                                Reset
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Loading State */}
            {isLoading && !certificates.length ? (
                <div className="flex items-center justify-center py-12">
                    <LoadingSpinner text="Loading certificates..." />
                </div>
            ) : filteredCerts.length === 0 ? (
                <Card className="shadow-sm border-border">
                    <CardContent>
                        <EmptyState
                            icon={
                                <HugeiconsIcon
                                    icon={Certificate02Icon}
                                    className="w-12 h-12"
                                    strokeWidth={1.5}
                                />
                            }
                            title={
                                certificates.length === 0
                                    ? "No certificates yet"
                                    : "No results"
                            }
                            description={
                                certificates.length === 0
                                    ? "Create your first certificate by generating a CSR or importing an existing one."
                                    : "Try adjusting your filters or search term."
                            }
                            action={
                                certificates.length === 0
                                    ? {
                                          label: "Generate CSR",
                                          onClick: () =>
                                              navigate(
                                                  "/certificates/generate",
                                              ),
                                      }
                                    : undefined
                            }
                        />
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence mode="sync">
                        {filteredCerts.map((cert) => {
                            const isSelected = selectedHostname === cert.hostname;

                            return (
                                <motion.div
                                    key={cert.hostname}
                                    initial={{ opacity: 1, x: 0 }}
                                    animate={{
                                        // Selected card counter-animates to stay in place
                                        // while the page wrapper moves -40px and fades
                                        opacity: isSelected && isAnimatingOut ? 0 : 1,
                                        x: isSelected ? 40 : 0,
                                    }}
                                    transition={{
                                        x: {
                                            duration: 0.25,
                                            ease: [0.4, 0, 0.2, 1],
                                        },
                                        opacity: isSelected ? {
                                            duration: 0.1,
                                            delay: 0.15, // Fade at the end of page animation
                                            ease: "easeOut",
                                        } : {
                                            duration: 0.25,
                                            ease: [0.4, 0, 0.2, 1],
                                        },
                                    }}
                                    className={isAnimatingOut ? "pointer-events-none" : ""}
                                >
                                    <Card
                                        className="shadow-sm border-border hover:shadow-lg hover:border-border/80 transition-all cursor-pointer group"
                                        onClick={() => handleCardClick(cert.hostname)}
                                        onContextMenu={(e) => handleContextMenu(e, cert)}
                                    >
                                        <CardContent>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <HugeiconsIcon
                                                            icon={Certificate02Icon}
                                                            className="w-5 h-5 text-muted-foreground"
                                                            strokeWidth={2}
                                                        />
                                                        <h3 className="text-lg font-semibold text-foreground">
                                                            {cert.hostname}
                                                        </h3>
                                                        <AnimatePresence mode="sync">
                                                            <StatusBadge
                                                                key={`status-${cert.status}`}
                                                                status={cert.status}
                                                                daysUntilExpiration={
                                                                    cert.days_until_expiration
                                                                }
                                                            />
                                                            {cert.has_pending_csr && cert.status !== "pending" && (
                                                                <RenewalBadge key="renewal-badge" />
                                                            )}
                                                            {cert.read_only && (
                                                                <ReadOnlyBadge key="read-only-badge" />
                                                            )}
                                                        </AnimatePresence>
                                                    </div>

                                                    {cert.sans && cert.sans.length > 0 && (
                                                        <div className="text-sm text-muted-foreground">
                                                            SANs: {cert.sans.join(", ")}
                                                        </div>
                                                    )}

                                                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                                        <div>
                                                            <span className="font-medium">
                                                                Created:
                                                            </span>{" "}
                                                            {formatDate(cert.created_at)}
                                                        </div>
                                                        {cert.expires_at && (
                                                            <div>
                                                                <span className="font-medium">
                                                                    Expires:
                                                                </span>{" "}
                                                                {formatDate(
                                                                    cert.expires_at,
                                                                )}
                                                            </div>
                                                        )}
                                                        {cert.key_size && (
                                                            <div>
                                                                <span className="font-medium">
                                                                    Key Size:
                                                                </span>{" "}
                                                                {cert.key_size} bits
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="ml-4 flex items-center">
                                                    <HugeiconsIcon
                                                        icon={ArrowRight01Icon}
                                                        className="w-5 h-5 text-muted-foreground/60 group-hover:text-muted-foreground group-hover:translate-x-1 transition-all"
                                                        strokeWidth={2}
                                                    />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

                {/* Certificates Count */}
                <div className="mt-8 text-center text-sm text-muted-foreground">
                    Showing {filteredCerts.length} of {certificates.length}{" "}
                    certificates
                </div>
            </motion.div>

            {/* Encryption Key Dialog */}
            <EncryptionKeyDialog
                open={showKeyDialog}
                onClose={() => setShowKeyDialog(false)}
            />
        </>
    );
}
