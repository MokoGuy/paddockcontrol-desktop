import { UseFormRegister, FieldErrors, Control, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type SetupRequestInput } from "@/lib/validation";

interface CertDefaultsStepProps {
  register: UseFormRegister<SetupRequestInput>;
  errors: FieldErrors<SetupRequestInput>;
  control: Control<SetupRequestInput>;
  isSubmitting: boolean;
}

export function CertDefaultsStep({ register, errors, control, isSubmitting }: CertDefaultsStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="validity_period_days">Validity Period (days) *</Label>
        <Input
          id="validity_period_days"
          type="number"
          placeholder="365"
          disabled={isSubmitting}
          onKeyDown={(e) => {
            // Allow Enter to propagate to form for step navigation
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          {...register("validity_period_days", { valueAsNumber: true })}
        />
        {errors.validity_period_days && (
          <p className="text-sm text-destructive">
            {errors.validity_period_days.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Default validity for CSR, ensuring consistency (1-3650 days)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="default_key_size">Key Size *</Label>
        <Controller
          name="default_key_size"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value?.toString()}
              onValueChange={(value) => field.onChange(parseInt(value))}
              disabled={isSubmitting}
            >
              <SelectTrigger id="default_key_size">
                <SelectValue placeholder="Select key size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2048">2048 bits</SelectItem>
                <SelectItem value="3072">3072 bits</SelectItem>
                <SelectItem value="4096">4096 bits (Recommended)</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.default_key_size && (
          <p className="text-sm text-destructive">
            {errors.default_key_size.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Default key size for CSR. 4096 bits recommended, 2048 bits minimum.
        </p>
      </div>
    </div>
  );
}
