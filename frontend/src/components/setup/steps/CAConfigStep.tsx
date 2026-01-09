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
          A descriptive name for your Certificate Authority
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
          All certificate hostnames will use this domain suffix (e.g., .example.com)
        </p>
      </div>

      <div className="p-4 bg-muted/50 border border-border rounded-lg">
        <p className="text-sm text-muted-foreground">
          The hostname suffix enforces consistent naming across all certificates.
          For example, with suffix ".example.com", a certificate for "server1"
          will have the full hostname "server1.example.com".
        </p>
      </div>
    </div>
  );
}
