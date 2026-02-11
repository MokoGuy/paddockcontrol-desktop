import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SetupRequestInput } from "@/lib/validation";

interface CAConfigStepProps {
  register: UseFormRegister<SetupRequestInput>;
  errors: FieldErrors<SetupRequestInput>;
  isSubmitting: boolean;
}

export function CAConfigStep({ register, errors, isSubmitting }: CAConfigStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="ca_name">CA Name *</Label>
        <Input
          id="ca_name"
          placeholder="My Company CA"
          disabled={isSubmitting}
          {...register("ca_name")}
        />
        {errors.ca_name && (
          <p className="text-sm text-destructive">
            {errors.ca_name.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          A friendly name for the CA that will validate and sign your requests
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hostname_suffix">Hostname Suffix *</Label>
        <Input
          id="hostname_suffix"
          placeholder=".example.com"
          disabled={isSubmitting}
          {...register("hostname_suffix")}
        />
        {errors.hostname_suffix && (
          <p className="text-sm text-destructive">
            {errors.hostname_suffix.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Default suffix for hostnames, enforcing consistency (e.g., ".example.com")
        </p>
      </div>
    </div>
  );
}
