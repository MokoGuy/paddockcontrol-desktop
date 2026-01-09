import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SetupRequestInput } from "@/lib/validation";

interface OrganizationStepProps {
  register: UseFormRegister<SetupRequestInput>;
  errors: FieldErrors<SetupRequestInput>;
  isSubmitting: boolean;
}

export function OrganizationStep({ register, errors, isSubmitting }: OrganizationStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="default_organization">Organization *</Label>
        <Input
          id="default_organization"
          placeholder="Acme Corporation"
          disabled={isSubmitting}
          {...register("default_organization")}
        />
        {errors.default_organization && (
          <p className="text-sm text-destructive">
            {errors.default_organization.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="default_organizational_unit">Organizational Unit</Label>
        <Input
          id="default_organizational_unit"
          placeholder="IT Department"
          disabled={isSubmitting}
          {...register("default_organizational_unit")}
        />
        {errors.default_organizational_unit && (
          <p className="text-sm text-destructive">
            {errors.default_organizational_unit.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Optional</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="default_city">City *</Label>
          <Input
            id="default_city"
            placeholder="San Francisco"
            disabled={isSubmitting}
            {...register("default_city")}
          />
          {errors.default_city && (
            <p className="text-sm text-destructive">
              {errors.default_city.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="default_state">State *</Label>
          <Input
            id="default_state"
            placeholder="California"
            disabled={isSubmitting}
            {...register("default_state")}
          />
          {errors.default_state && (
            <p className="text-sm text-destructive">
              {errors.default_state.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="default_country">Country Code *</Label>
        <Input
          id="default_country"
          placeholder="US"
          maxLength={2}
          disabled={isSubmitting}
          {...register("default_country")}
        />
        {errors.default_country && (
          <p className="text-sm text-destructive">
            {errors.default_country.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Two-letter ISO country code (e.g., US, FR, DE)
        </p>
      </div>

      <div className="p-4 bg-muted/50 border border-border rounded-lg">
        <p className="text-sm text-muted-foreground">
          These organization details will be used as defaults when generating
          new certificates. You can override them for individual certificates.
        </p>
      </div>
    </div>
  );
}
