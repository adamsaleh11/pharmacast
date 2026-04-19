import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, actionLabel, className }: EmptyStateProps) {
  return (
    <div className={cn("flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-white p-8 text-center", className)}>
      <div className="mb-3 rounded-md bg-teal-50 p-2 text-pharma-teal">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionLabel ? (
        <Button className="mt-4" variant="teal" type="button">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
