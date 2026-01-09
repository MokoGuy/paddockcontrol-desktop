export type WizardStep = "email" | "ca-config" | "organization" | "cert-defaults" | "encryption-key" | "review";

interface StepConfig {
  id: WizardStep;
  label: string;
  number: number;
}

const STEPS: StepConfig[] = [
  { id: "email", label: "Email", number: 1 },
  { id: "ca-config", label: "CA Config", number: 2 },
  { id: "organization", label: "Organization", number: 3 },
  { id: "cert-defaults", label: "Defaults", number: 4 },
  { id: "encryption-key", label: "Security", number: 5 },
  { id: "review", label: "Review", number: 6 },
];

function getStepIndex(step: WizardStep): number {
  return STEPS.findIndex((s) => s.id === step);
}

interface SetupWizardStepsProps {
  currentStep: WizardStep;
}

export function SetupWizardSteps({ currentStep }: SetupWizardStepsProps) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="border-b border-border px-6 pb-4">
      <div className="flex items-center gap-2 text-sm">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isActive = step.id === currentStep;
          const isLast = index === STEPS.length - 1;

          return (
            <div key={step.id} className="contents">
              {/* Step circle */}
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full font-semibold transition-all duration-200 ${
                  isCompleted || isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? "✓" : step.number}
              </div>
              {/* Step label */}
              <span
                className={`transition-colors duration-200 ${
                  isActive
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
              {/* Connecting line (except after last step) */}
              {!isLast && (
                <div className="flex-1 h-0.5 mx-2 bg-muted transition-colors duration-200" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { STEPS, getStepIndex };
