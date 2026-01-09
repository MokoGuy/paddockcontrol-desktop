import { UseFormGetValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type SetupRequestInput } from "@/lib/validation";
import { type WizardStep } from "../SetupWizardSteps";

interface ReviewStepProps {
  getValues: UseFormGetValues<SetupRequestInput>;
  onEditStep: (step: WizardStep) => void;
}

interface ReviewSectionProps {
  title: string;
  step: WizardStep;
  onEdit: () => void;
  children: React.ReactNode;
}

function ReviewSection({ title, onEdit, children }: ReviewSectionProps) {
  return (
    <div className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">{title}</h3>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

interface ReviewFieldProps {
  label: string;
  value: string | number | undefined;
}

function ReviewField({ label, value }: ReviewFieldProps) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">
        {value || <span className="text-muted-foreground italic">Not set</span>}
      </span>
    </div>
  );
}

export function ReviewStep({ getValues, onEditStep }: ReviewStepProps) {
  const values = getValues();

  return (
    <div className="space-y-6">
      <div className="p-4 bg-muted/50 border border-border rounded-lg">
        <p className="text-sm text-muted-foreground">
          Please review your configuration before creating the Certificate Authority.
        </p>
      </div>

      <div className="space-y-4">
        <ReviewSection
          title="Owner Email"
          step="email"
          onEdit={() => onEditStep("email")}
        >
          <ReviewField label="Email" value={values.owner_email} />
        </ReviewSection>

        <ReviewSection
          title="CA Configuration"
          step="ca-config"
          onEdit={() => onEditStep("ca-config")}
        >
          <ReviewField label="CA Name" value={values.ca_name} />
          <ReviewField label="Hostname Suffix" value={values.hostname_suffix} />
        </ReviewSection>

        <ReviewSection
          title="Organization"
          step="organization"
          onEdit={() => onEditStep("organization")}
        >
          <ReviewField label="Organization" value={values.default_organization} />
          <ReviewField label="Organizational Unit" value={values.default_organizational_unit} />
          <ReviewField label="City" value={values.default_city} />
          <ReviewField label="State" value={values.default_state} />
          <ReviewField label="Country" value={values.default_country} />
        </ReviewSection>

        <ReviewSection
          title="Certificate Defaults"
          step="cert-defaults"
          onEdit={() => onEditStep("cert-defaults")}
        >
          <ReviewField
            label="Validity Period"
            value={values.validity_period_days ? `${values.validity_period_days} days` : undefined}
          />
          <ReviewField
            label="Key Size"
            value={values.default_key_size ? `${values.default_key_size} bits` : undefined}
          />
        </ReviewSection>

        <ReviewSection
          title="Security"
          step="encryption-key"
          onEdit={() => onEditStep("encryption-key")}
        >
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Encryption Key</span>
            <Badge variant={values.encryption_key ? "default" : "destructive"}>
              {values.encryption_key ? "Set" : "Not Set"}
            </Badge>
          </div>
          {values.encryption_key && (
            <p className="text-xs text-muted-foreground mt-2">
              Your encryption key is {values.encryption_key.length} characters long.
              Make sure to remember it - you'll need it to unlock the app.
            </p>
          )}
        </ReviewSection>
      </div>
    </div>
  );
}
