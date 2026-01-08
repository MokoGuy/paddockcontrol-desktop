import { useForm, Controller } from "react-hook-form";
import { UpdateConfigRequest } from "@/types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface ConfigEditFormProps {
    config: UpdateConfigRequest;
    onSave: (data: UpdateConfigRequest) => void;
    onCancel: () => void;
    isLoading?: boolean;
    open: boolean;
}

export function ConfigEditForm({
    config,
    onSave,
    onCancel,
    isLoading = false,
    open,
}: ConfigEditFormProps) {
    const {
        register,
        handleSubmit,
        control,
        formState: { errors, isDirty },
    } = useForm<UpdateConfigRequest>({
        defaultValues: config,
    });

    const onSubmit = (data: UpdateConfigRequest) => {
        onSave(data);
    };

    const handleCancel = () => {
        if (isDirty) {
            if (
                window.confirm(
                    "You have unsaved changes. Are you sure you want to cancel?",
                )
            ) {
                onCancel();
            }
        } else {
            onCancel();
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => !isOpen && handleCancel()}
        >
            <DialogContent
                className="!max-w-3xl sm:!max-w-3xl max-h-[90vh] overflow-y-auto"
                showCloseButton={false}
            >
                <DialogHeader>
                    <DialogTitle>Edit Configuration</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Instance Configuration */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">
                                Instance Configuration
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="owner_email">
                                        Default Certificate Owner Email *
                                    </Label>
                                    <Input
                                        id="owner_email"
                                        type="email"
                                        {...register("owner_email", {
                                            required: "Email is required",
                                            pattern: {
                                                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                                message: "Invalid email format",
                                            },
                                            maxLength: {
                                                value: 255,
                                                message:
                                                    "Email must not exceed 255 characters",
                                            },
                                        })}
                                        className={
                                            errors.owner_email
                                                ? "border-red-500"
                                                : ""
                                        }
                                        disabled={isLoading}
                                    />
                                    {errors.owner_email && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {errors.owner_email.message}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        This email will be used as the default
                                        contact for certificates
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Certificate Authority Configuration */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">
                                Certificate Authority Configuration
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ca_name">CA Name *</Label>
                                    <Input
                                        id="ca_name"
                                        {...register("ca_name", {
                                            required: "CA Name is required",
                                            maxLength: {
                                                value: 255,
                                                message:
                                                    "CA Name must not exceed 255 characters",
                                            },
                                        })}
                                        className={
                                            errors.ca_name
                                                ? "border-red-500"
                                                : ""
                                        }
                                        disabled={isLoading}
                                    />
                                    {errors.ca_name && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {errors.ca_name.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="hostname_suffix">
                                        Hostname Suffix *
                                    </Label>
                                    <Input
                                        id="hostname_suffix"
                                        {...register("hostname_suffix", {
                                            required:
                                                "Hostname suffix is required",
                                            pattern: {
                                                value: /^\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/,
                                                message:
                                                    "Hostname suffix must start with a dot and be a valid domain (e.g., .dedalus.lan)",
                                            },
                                            maxLength: {
                                                value: 255,
                                                message:
                                                    "Hostname suffix must not exceed 255 characters",
                                            },
                                        })}
                                        className={
                                            errors.hostname_suffix
                                                ? "border-red-500"
                                                : ""
                                        }
                                        disabled={isLoading}
                                    />
                                    {errors.hostname_suffix && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {errors.hostname_suffix.message}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        All certificate hostnames must end with
                                        this suffix
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="validity_period_days">
                                        Validity Period (days) *
                                    </Label>
                                    <Input
                                        id="validity_period_days"
                                        type="number"
                                        {...register("validity_period_days", {
                                            required:
                                                "Validity period is required",
                                            valueAsNumber: true,
                                            min: {
                                                value: 1,
                                                message:
                                                    "Validity period must be at least 1 day",
                                            },
                                            max: {
                                                value: 3650,
                                                message:
                                                    "Validity period must not exceed 3650 days (10 years)",
                                            },
                                        })}
                                        className={
                                            errors.validity_period_days
                                                ? "border-red-500"
                                                : ""
                                        }
                                        disabled={isLoading}
                                    />
                                    {errors.validity_period_days && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {
                                                errors.validity_period_days
                                                    .message
                                            }
                                        </p>
                                    )}
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                        ⚠️ Changes only affect new certificates
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Certificate Defaults */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">
                                Certificate Defaults
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="default_organization">
                                        Organization *
                                    </Label>
                                    <Input
                                        id="default_organization"
                                        {...register("default_organization", {
                                            required:
                                                "Organization is required",
                                            maxLength: {
                                                value: 255,
                                                message:
                                                    "Organization must not exceed 255 characters",
                                            },
                                        })}
                                        className={
                                            errors.default_organization
                                                ? "border-red-500"
                                                : ""
                                        }
                                        disabled={isLoading}
                                    />
                                    {errors.default_organization && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {
                                                errors.default_organization
                                                    .message
                                            }
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="default_organizational_unit">
                                        Organizational Unit
                                    </Label>
                                    <Input
                                        id="default_organizational_unit"
                                        {...register(
                                            "default_organizational_unit",
                                            {
                                                maxLength: {
                                                    value: 255,
                                                    message:
                                                        "Organizational unit must not exceed 255 characters",
                                                },
                                            },
                                        )}
                                        className={
                                            errors.default_organizational_unit
                                                ? "border-red-500"
                                                : ""
                                        }
                                        disabled={isLoading}
                                    />
                                    {errors.default_organizational_unit && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {
                                                errors
                                                    .default_organizational_unit
                                                    .message
                                            }
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="default_city">City *</Label>
                                    <Input
                                        id="default_city"
                                        {...register("default_city", {
                                            required: "City is required",
                                            maxLength: {
                                                value: 255,
                                                message:
                                                    "City must not exceed 255 characters",
                                            },
                                        })}
                                        className={
                                            errors.default_city
                                                ? "border-red-500"
                                                : ""
                                        }
                                        disabled={isLoading}
                                    />
                                    {errors.default_city && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {errors.default_city.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="default_state">
                                        State/Province *
                                    </Label>
                                    <Input
                                        id="default_state"
                                        {...register("default_state", {
                                            required:
                                                "State/Province is required",
                                            maxLength: {
                                                value: 255,
                                                message:
                                                    "State must not exceed 255 characters",
                                            },
                                        })}
                                        className={
                                            errors.default_state
                                                ? "border-red-500"
                                                : ""
                                        }
                                        disabled={isLoading}
                                    />
                                    {errors.default_state && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {errors.default_state.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="default_country">
                                        Country Code (2 letters) *
                                    </Label>
                                    <Input
                                        id="default_country"
                                        maxLength={2}
                                        {...register("default_country", {
                                            required:
                                                "Country code is required",
                                            pattern: {
                                                value: /^[A-Z]{2}$/,
                                                message:
                                                    "Country code must be exactly 2 uppercase letters (ISO 3166-1 alpha-2)",
                                            },
                                        })}
                                        className={
                                            errors.default_country
                                                ? "border-red-500"
                                                : ""
                                        }
                                        disabled={isLoading}
                                        style={{ textTransform: "uppercase" }}
                                    />
                                    {errors.default_country && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {errors.default_country.message}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        ISO 3166-1 alpha-2 code (e.g., IT, US,
                                        DE)
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="default_key_size">
                                        Default Key Size *
                                    </Label>
                                    <Controller
                                        name="default_key_size"
                                        control={control}
                                        rules={{
                                            required: "Key size is required",
                                            validate: (value) =>
                                                [2048, 3072, 4096].includes(
                                                    value,
                                                ) ||
                                                "Key size must be 2048, 3072, or 4096",
                                        }}
                                        render={({ field }) => (
                                            <Select
                                                value={field.value?.toString()}
                                                onValueChange={(value) =>
                                                    field.onChange(
                                                        parseInt(value),
                                                    )
                                                }
                                                disabled={isLoading}
                                            >
                                                <SelectTrigger
                                                    className={`w-full ${
                                                        errors.default_key_size
                                                            ? "border-red-500"
                                                            : ""
                                                    }`}
                                                >
                                                    <SelectValue placeholder="Select key size" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="2048">
                                                        2048 bits
                                                    </SelectItem>
                                                    <SelectItem value="3072">
                                                        3072 bits
                                                    </SelectItem>
                                                    <SelectItem value="4096">
                                                        4096 bits (Recommended)
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.default_key_size && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {errors.default_key_size.message}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                        <Button type="submit" disabled={isLoading || !isDirty}>
                            {isLoading ? "Saving..." : "Save Changes"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
