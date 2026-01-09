import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCertificates } from "@/hooks/useCertificates";
import { useKonamiCode } from "@/hooks/useKonamiCode";
import { useAppStore } from "@/stores/useAppStore";
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
import { EmptyState } from "@/components/shared/EmptyState";
import { EncryptionKeyDialog } from "@/components/shared/EncryptionKeyDialog";
import { StatusBadge } from "@/components/certificate/StatusBadge";
import { ReadOnlyBadge } from "@/components/certificate/ReadOnlyBadge";
import { formatDate } from "@/lib/theme";
import { CertificateFilter } from "@/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Certificate02Icon,
    ArrowRight01Icon,
    Search01Icon,
} from "@hugeicons/core-free-icons";

export function Dashboard() {
    const navigate = useNavigate();
    const { certificates, isLoading, error, listCertificates } =
        useCertificates();
    const { isEncryptionKeyProvided, setIsAdminModeEnabled } = useAppStore();

    // Konami code to enable admin mode
    useKonamiCode(() => {
        setIsAdminModeEnabled(true);
    });

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<
        "all" | "pending" | "active" | "expiring" | "expired"
    >("all");
    const [sortBy, setSortBy] = useState<"created" | "expiring" | "hostname">(
        "created",
    );
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [showKeyDialog, setShowKeyDialog] = useState(false);

    useEffect(() => {
        loadCertificates();
    }, []);

    useEffect(() => {
        loadCertificates();
    }, [statusFilter, sortBy, sortOrder]);

    const loadCertificates = async () => {
        const filter: CertificateFilter = {
            status: statusFilter,
            sort_by: sortBy,
            sort_order: sortOrder,
        };
        await listCertificates(filter);
    };

    const handleStatusFilterChange = (status: string) => {
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

    return (
        <>
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
                    <Button
                        onClick={() => navigate("/certificates/generate")}
                        disabled={!isEncryptionKeyProvided}
                        title={
                            !isEncryptionKeyProvided
                                ? "Encryption key required"
                                : ""
                        }
                    >
                        Generate CSR
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => navigate("/certificates/import")}
                        disabled={!isEncryptionKeyProvided}
                        title={
                            !isEncryptionKeyProvided
                                ? "Encryption key required"
                                : ""
                        }
                    >
                        Import Certificate
                    </Button>
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
                <Card className="mb-6 bg-destructive/10 border-destructive/30">
                    <CardContent>
                        <p className="text-sm text-destructive">
                            {error}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Limited Mode Notice */}
            {!isEncryptionKeyProvided && (
                <Card className="mb-6 bg-warning-muted border-warning/30">
                    <CardContent className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-warning-foreground">
                                Limited mode - encryption key not provided
                            </p>
                            <p className="text-xs text-warning-foreground/80 mt-1">
                                Some features are disabled. Provide your
                                encryption key to unlock full functionality.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-warning/50 text-warning-foreground hover:bg-warning/20"
                            onClick={() => setShowKeyDialog(true)}
                        >
                            Provide Key
                        </Button>
                    </CardContent>
                </Card>
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
                                onChange={(e) => setSearchTerm(e.target.value)}
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
                    {filteredCerts.map((cert) => (
                        <Card
                            key={cert.hostname}
                            className="shadow-sm border-border hover:shadow-lg hover:border-border/80 transition-all cursor-pointer group"
                            onClick={() =>
                                navigate(`/certificates/${cert.hostname}`)
                            }
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
                                            <StatusBadge
                                                status={cert.status}
                                                daysUntilExpiration={
                                                    cert.days_until_expiration
                                                }
                                            />
                                            {cert.read_only && <ReadOnlyBadge />}
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
                    ))}
                </div>
            )}

            {/* Certificates Count */}
            <div className="mt-8 text-center text-sm text-muted-foreground">
                Showing {filteredCerts.length} of {certificates.length}{" "}
                certificates
            </div>

            {/* Encryption Key Dialog */}
            <EncryptionKeyDialog
                open={showKeyDialog}
                onClose={() => setShowKeyDialog(false)}
            />
        </>
    );
}
