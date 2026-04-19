import { Badge } from "@/components/ui/badge";

export type ConfidenceValue = "low" | "medium" | "high";

const confidenceDisplay: Record<
  ConfidenceValue,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  low: { label: "Low confidence", variant: "warning" },
  medium: { label: "Medium confidence", variant: "teal" },
  high: { label: "High confidence", variant: "success" }
};

export function ConfidenceBadge({ value }: { value: ConfidenceValue }) {
  const confidence = confidenceDisplay[value];
  return <Badge variant={confidence.variant}>{confidence.label}</Badge>;
}
