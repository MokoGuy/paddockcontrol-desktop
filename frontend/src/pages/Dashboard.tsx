import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCertificates } from "@/hooks/useCertificates";
import { useAppStore } from "@/stores/useAppStore";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/layout/Header";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/certificate/StatusBadge";
import { formatDate } from "@/lib/theme";
import { CertificateFilter } from "@/types";

export function Dashboard() {
    const navigate = useNavigate();
    const {
        certificates,
        isLoading,
        error,
        listCertificates,
        deleteCertificate,
    } = useCertificates();
    const { setError: setAppError } = useAppStore();

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<
        "all" | "pending" | "active" | "expiring" | "expired"
    >("all");
    const [sortBy, setSortBy] = useState<"created" | "expiring" | "hostname">(
        "created",
    );
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [deleteConfirming, setDeleteConfirming] = useState<string | null>(
        null,
    );

    useEffect(() => {
        loadCertificates();
    }, []);

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

    const handleDelete = async (hostname: string) => {
        try {
            await deleteCertificate(hostname);
            setDeleteConfirming(null);
            setAppError(null);
        } catch (err) {
            console.error("Delete error:", err);
        }
    };

    const filteredCerts = certificates.filter(
        (cert) =>
            cert.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cert.sans?.some((san) =>
                san.toLowerCase().includes(searchTerm.toLowerCase()),
            ),
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                            onClick={() => navigate("/certificates/generate")}
                        >
                            Generate CSR
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => navigate("/certificates/import")}
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
                        <CardContent className="pt-6">
                            <p className="text-sm text-red-800 dark:text-red-200">
                                {error}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Filters Card */}
                <Card className="mb-6 shadow-sm border-gray-200 dark:border-gray-800">
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            {/* Search */}
                            <div>
                                <Input
                                    placeholder="Search by hostname or SAN..."
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
                                    className="max-w-md"
                                />
                            </div>

                            {/* Filter and Sort Controls */}
                            <div className="flex flex-wrap gap-4">
                                {/* Status Filter */}
                                <div className="space-y-2">
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
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Sort By
                                    </label>
                                    <div className="flex gap-2">
                                        <select
                                            value={sortBy}
                                            onChange={(e) =>
                                                setSortBy(e.target.value as any)
                                            }
                                            className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                                        >
                                            <option value="created">
                                                Created
                                            </option>
                                            <option value="expiring">
                                                Expiring
                                            </option>
                                            <option value="hostname">
                                                Hostname
                                            </option>
                                        </select>
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
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={loadCertificates}
                                            disabled={isLoading}
                                        >
                                            {isLoading
                                                ? "Refreshing..."
                                                : "Refresh"}
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
                        <CardContent className="pt-6">
                            <EmptyState
                                icon="📜"
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
                                    navigate(`/certificates/${cert.hostname}`)
                                }
                            >
                                <CardContent className="pt-6">
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
                                                        {cert.sans.join(", ")}
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
                                            {!cert.read_only && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfirming(
                                                            cert.hostname,
                                                        );
                                                    }}
                                                >
                                                    Delete
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Delete Confirmation Dialog */}
                {deleteConfirming && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-sm">
                            <CardHeader>
                                <CardTitle>Delete Certificate</CardTitle>
                                <CardDescription>
                                    Are you sure you want to delete{" "}
                                    {deleteConfirming}?
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    This action cannot be undone. The
                                    certificate and all its data will be
                                    permanently deleted.
                                </p>
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() =>
                                            setDeleteConfirming(null)
                                        }
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="flex-1 bg-red-600 hover:bg-red-700"
                                        onClick={() =>
                                            handleDelete(deleteConfirming)
                                        }
                                        disabled={isLoading}
                                    >
                                        {isLoading ? "Deleting..." : "Delete"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Certificates Count */}
                <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                    Showing {filteredCerts.length} of {certificates.length}{" "}
                    certificates
                </div>
            </main>
        </div>
    );
}
