import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { normalizeDin } from "@/lib/api/drugs";
import { cn } from "@/lib/utils";
import type { DrugResponse } from "@/types/drug";

type DrugIdentityProps = {
  din: string;
  fallbackName: string;
  metadata?: DrugResponse | null;
  className?: string;
};

export function formatDrugIdentityName(fallbackName: string, metadata?: DrugResponse | null) {
  if (!metadata) {
    return fallbackName;
  }

  const strength = metadata.strength.trim();

  if (!strength || strength.toLowerCase() === "unknown") {
    return metadata.name;
  }

  return `${metadata.name} ${strength}`;
}

function isDiscontinued(metadata?: DrugResponse | null) {
  return metadata?.status === "CANCELLED" || metadata?.status === "DORMANT";
}

export function DrugIdentity({ din, fallbackName, metadata, className }: DrugIdentityProps) {
  const displayDin = normalizeDin(din) ?? din;
  const displayName = formatDrugIdentityName(fallbackName, metadata);
  const discontinued = isDiscontinued(metadata);

  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="min-w-0 font-medium text-foreground">{displayName}</span>
        {metadata?.status === "UNVERIFIED" ? (
          <Badge variant="muted">Unverified DIN</Badge>
        ) : null}
        {discontinued ? (
          <Badge variant="danger" className="gap-1">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Discontinued
          </Badge>
        ) : null}
      </div>
      <div className="font-mono text-xs text-muted-foreground">{displayDin}</div>
    </div>
  );
}

export { isDiscontinued };
