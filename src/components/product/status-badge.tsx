import { Badge } from "@/components/ui/badge";

export type StatusBadgeValue =
  | "ok"
  | "amber"
  | "red"
  | "active"
  | "inactive"
  | "unknown"
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "draft"
  | "reviewed"
  | "sent"
  | "cancelled";

const statusDisplay: Record<StatusBadgeValue, { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }> = {
  ok: { label: "OK", variant: "success" },
  amber: { label: "Amber", variant: "warning" },
  red: { label: "Red", variant: "danger" },
  active: { label: "Active", variant: "success" },
  inactive: { label: "Inactive", variant: "muted" },
  unknown: { label: "Unknown", variant: "muted" },
  pending: { label: "Pending", variant: "warning" },
  processing: { label: "Processing", variant: "teal" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  draft: { label: "Draft", variant: "muted" },
  reviewed: { label: "Reviewed", variant: "teal" },
  sent: { label: "Sent", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" }
};

export function StatusBadge({ value }: { value: StatusBadgeValue }) {
  const status = statusDisplay[value];
  return <Badge variant={status.variant}>{status.label}</Badge>;
}
