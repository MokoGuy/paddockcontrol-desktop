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

  const encryptionKey = watch("encryption_key");
  const confirmKey = watch("encryption_key_confirm");

  const keysMatch = encryptionKey && confirmKey && encryptionKey === confirmKey;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="encryption_key">Encryption Key *</Label>
        <div className="relative">
          <Input
            id="encryption_key"
            type={showKey ? "text" : "password"}
            placeholder="Enter a secure encryption key"
            disabled={isSubmitting}
            className="pr-10"
            {...register("encryption_key")}
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
        {errors.encryption_key && (
          <p className="text-sm text-destructive">
            {errors.encryption_key.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Protects your private keys. Required each time you open the app.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="encryption_key_confirm">Confirm Encryption Key *</Label>
        <div className="relative">
          <Input
            id="encryption_key_confirm"
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm your encryption key"
            disabled={isSubmitting}
            className="pr-10"
            {...register("encryption_key_confirm")}
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
        {errors.encryption_key_confirm && (
          <p className="text-sm text-destructive">
            {errors.encryption_key_confirm.message}
          </p>
        )}
        {encryptionKey && confirmKey && !keysMatch && (
          <p className="text-sm text-destructive">
            Keys do not match
          </p>
        )}
        {keysMatch && (
          <p className="text-sm text-green-600">
            Keys match
          </p>
        )}
      </div>
    </div>
  );
}
