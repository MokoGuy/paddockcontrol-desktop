import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SetupRequestInput } from "@/lib/validation";

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
        <p className="text-xs text-muted-foreground">
          Will be included in certificate signing requests (CSR)
        </p>
      </div>
    </div>
  );
}
