import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SetupRequestInput } from "@/lib/validation";
import { StatusAlert } from "@/components/shared/StatusAlert";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

interface UserEmailStepProps {
  register: UseFormRegister<SetupRequestInput>;
  errors: FieldErrors<SetupRequestInput>;
  isSubmitting: boolean;
}

export function UserEmailStep({ register, errors, isSubmitting }: UserEmailStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="owner_email">Owner Email *</Label>
        <Input
          id="owner_email"
          type="email"
          placeholder="admin@example.com"
          disabled={isSubmitting}
          {...register("owner_email")}
        />
        {errors.owner_email && (
          <p className="text-sm text-destructive">
            {errors.owner_email.message}
          </p>
        )}
      </div>

      <StatusAlert
        variant="muted"
        icon={
          <HugeiconsIcon
            icon={InformationCircleIcon}
            className="size-4"
            strokeWidth={2}
          />
        }
      >
        This email will be used as the owner contact for your Certificate Authority.
        It may be included in certificates and used for administrative notifications.
      </StatusAlert>
    </div>
  );
}
