import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCertificates } from "@/hooks/useCertificates";
import { useAppStore } from "@/stores/useAppStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/layout/Header";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { EncryptionKeyDialog } from "@/components/shared/EncryptionKeyDialog";
import { StatusBadge } from "@/components/certificate/StatusBadge";
import { formatDate } from "@/lib/theme";
import { CertificateFilter } from "@/types";
import { HugeiconsIcon } from "@hugeicons/react";
import { Certificate02Icon } from "@hugeicons/core-free-icons";

export function Dashboard() {
    const navigate = useNavigate();
    const { certificates, isLoading, error, listCertificates } =
        useCertificates();
    const { isEncryptionKeyProvided } = useAppStore();

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
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-slate-950">
            <Header />

            <main className="flex-1 overflow-y-auto scrollbar-float">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Page Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Certificates
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                Manage your SSL/TLS certificates
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() =>
                                    navigate("/certificates/generate")
                                }
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
                        <Card className="mb-6 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900">
                            <CardContent>
                                <p className="text-sm text-red-800 dark:text-red-200">
                                    {error}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Limited Mode Notice */}
                    {!isEncryptionKeyProvided && (
                        <Card className="mb-6 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900">
                            <CardContent className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                        Limited mode - encryption key not
                                        provided
                                    </p>
                                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                        Some features are disabled. Provide your
                                        encryption key to unlock full
                                        functionality.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
                                    onClick={() => setShowKeyDialog(true)}
                                >
                                    Provide Key
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Filters Card */}
                    <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
                        <CardContent>
                            <div className="space-y-4">
                                {/* Search */}
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Search by hostname or SAN..."
                                        value={searchTerm}
                                        onChange={(e) =>
                                            setSearchTerm(e.target.value)
                                        }
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={resetFilters}
                                        className="whitespace-nowrap"
                                    >
                                        Reset Filters
                                    </Button>
                                </div>

                                {/* Filter and Sort Controls */}
                                <div className="flex flex-wrap gap-6">
                                    {/* Status Filter */}
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Status
                                        </label>
                                        <div className="flex gap-2">
                                            {[
                                                "all",
                                                "pending",
                                                "active",
                                                "expiring",
                                                "expired",
                                            ].map((status) => (
                                                <Button
                                                    key={status}
                                                    variant={
                                                        statusFilter === status
                                                            ? "default"
                                                            : "outline"
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                        handleStatusFilterChange(
                                                            status,
                                                        )
                                                    }
                                                >
                                                    {status
                                                        .charAt(0)
                                                        .toUpperCase() +
                                                        status.slice(1)}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Sort Controls */}
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                                                {sortOrder === "asc"
                                                    ? "↑"
                                                    : "↓"}
                                            </Button>
                                        </div>
                                    </div>
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
                        <Card className="shadow-sm border-gray-200 dark:border-gray-800">
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
                                    className="shadow-sm border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() =>
                                        navigate(
                                            `/certificates/${cert.hostname}`,
                                        )
                                    }
                                >
                                    <CardContent>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                        {cert.hostname}
                                                    </h3>
                                                    <StatusBadge
                                                        status={cert.status}
                                                        daysUntilExpiration={
                                                            cert.days_until_expiration
                                                        }
                                                    />
                                                    {cert.read_only && (
                                                        <Badge variant="secondary">
                                                            Read-only
                                                        </Badge>
                                                    )}
                                                </div>

                                                {cert.sans &&
                                                    cert.sans.length > 0 && (
                                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                                            SANs:{" "}
                                                            {cert.sans.join(
                                                                ", ",
                                                            )}
                                                        </div>
                                                    )}

                                                <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
                                                    <div>
                                                        <span className="font-medium">
                                                            Created:
                                                        </span>{" "}
                                                        {formatDate(
                                                            cert.created_at,
                                                        )}
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

                                            <div className="flex gap-2 ml-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(
                                                            `/certificates/${cert.hostname}`,
                                                        );
                                                    }}
                                                >
                                                    View
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Certificates Count */}
                    <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                        Showing {filteredCerts.length} of {certificates.length}{" "}
                        certificates
                    </div>
                </div>
            </main>

            {/* Encryption Key Dialog */}
            <EncryptionKeyDialog
                open={showKeyDialog}
                onClose={() => setShowKeyDialog(false)}
            />
        </div>
    );
}
