import { useState } from "react";
import { UseFormRegister, FieldErrors, UseFormWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { type SetupRequestInput } from "@/lib/validation";
import { HugeiconsIcon } from "@hugeicons/react";
import { EyeIcon, ViewOffIcon } from "@hugeicons/core-free-icons";

interface EncryptionKeyStepProps {
  register: UseFormRegister<SetupRequestInput>;
  errors: FieldErrors<SetupRequestInput>;
  watch: UseFormWatch<SetupRequestInput>;
  isSubmitting: boolean;
}

export function EncryptionKeyStep({ register, errors, watch, isSubmitting }: EncryptionKeyStepProps) {
  const [showKey, setShowKey] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const password = watch("password");
  const confirmPassword = watch("password_confirm");

  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="password">Password *</Label>
        <div className="relative">
          <Input
            id="password"
            type={showKey ? "text" : "password"}
            placeholder="Enter a secure password"
            disabled={isSubmitting}
            className="pr-10"
            {...register("password")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <HugeiconsIcon
              icon={showKey ? ViewOffIcon : EyeIcon}
              className="w-4 h-4"
              strokeWidth={2}
            />
          </Button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Protects your private keys. Required each time you open the app.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password_confirm">Confirm Password *</Label>
        <div className="relative">
          <Input
            id="password_confirm"
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm your password"
            disabled={isSubmitting}
            className="pr-10"
            {...register("password_confirm")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <HugeiconsIcon
              icon={showConfirm ? ViewOffIcon : EyeIcon}
              className="w-4 h-4"
              strokeWidth={2}
            />
          </Button>
        </div>
        {errors.password_confirm && (
          <p className="text-sm text-destructive">
            {errors.password_confirm.message}
          </p>
        )}
        {password && confirmPassword && !passwordsMatch && (
          <p className="text-sm text-destructive">
            Passwords do not match
          </p>
        )}
        {passwordsMatch && (
          <p className="text-sm text-green-600">
            Passwords match
          </p>
        )}
      </div>
    </div>
  );
}
