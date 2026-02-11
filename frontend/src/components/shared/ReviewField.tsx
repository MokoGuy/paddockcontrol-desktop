import { Button } from "@/components/ui/button";

interface ReviewSectionProps {
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}

export function ReviewSection({ title, onEdit, children }: ReviewSectionProps) {
  return (
    <div className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">{title}</h3>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

interface ReviewFieldProps {
  label: string;
  value: string | number | undefined;
}

export function ReviewField({ label, value }: ReviewFieldProps) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">
        {value || <span className="text-muted-foreground italic">Not set</span>}
      </span>
    </div>
  );
}
