import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  DollarSign,
  FileWarning,
  Pill,
  type LucideIcon
} from "lucide-react";
import { parseNotificationPayload } from "@/lib/api/notifications";
import type { NotificationResponse, NotificationType, ParsedNotificationPayload } from "@/types/notification";

export type NotificationDisplayMeta = {
  label: string;
  Icon: LucideIcon;
  toneClassName: string;
};

export const notificationDisplay: Record<NotificationType, NotificationDisplayMeta> = {
  critical_reorder: {
    label: "Critical Alert",
    Icon: AlertCircle,
    toneClassName: "text-red-600 bg-red-50 border-red-200"
  },
  amber_reorder: {
    label: "Reorder Soon",
    Icon: AlertTriangle,
    toneClassName: "text-amber-600 bg-amber-50 border-amber-200"
  },
  daily_digest: {
    label: "Daily Digest",
    Icon: BarChart3,
    toneClassName: "text-teal-700 bg-teal-50 border-teal-200"
  },
  weekly_insight: {
    label: "Weekly Insights",
    Icon: BarChart3,
    toneClassName: "text-teal-700 bg-teal-50 border-teal-200"
  },
  csv_upload_completed: {
    label: "CSV Upload",
    Icon: CheckCircle2,
    toneClassName: "text-green-700 bg-green-50 border-green-200"
  },
  csv_upload_failed: {
    label: "CSV Issue",
    Icon: FileWarning,
    toneClassName: "text-red-600 bg-red-50 border-red-200"
  },
  purchase_order_draft: {
    label: "Purchase Order",
    Icon: DollarSign,
    toneClassName: "text-slate-700 bg-slate-50 border-slate-200"
  },
  DRUG_DISCONTINUED: {
    label: "Drug Discontinued",
    Icon: Pill,
    toneClassName: "text-purple-700 bg-purple-50 border-purple-200"
  }
};

export function formatRelativeTime(value: string | null | undefined, now = new Date()) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60]
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }

  return "Just now";
}

export function sentTimestamp(notification: NotificationResponse) {
  return notification.sent_at ?? notification.created_at;
}

export function notificationPayload(notification: NotificationResponse): ParsedNotificationPayload {
  return parseNotificationPayload(notification.payload);
}

export function notificationTarget(notification: NotificationResponse) {
  const payload = notificationPayload(notification);
  const din = typeof payload.din === "string" ? payload.din.trim() : "";
  return din ? `/dashboard?drug=${encodeURIComponent(din)}` : "/settings?tab=notifications";
}

export function notificationTitle(notification: NotificationResponse) {
  const payload = notificationPayload(notification);
  const drugName = typeof payload.drug_name === "string" ? payload.drug_name.trim() : "";
  const strength = typeof payload.strength === "string" ? payload.strength.trim() : "";
  const drugLabel = [drugName, strength].filter(Boolean).join(" ");

  if (drugLabel) {
    return drugLabel;
  }

  const meta = notificationDisplay[notification.type];
  return meta?.label ?? "Notification";
}

export function notificationDetail(notification: NotificationResponse) {
  const payload = notificationPayload(notification);
  const daysOfSupply = typeof payload.days_of_supply === "number" ? payload.days_of_supply : null;

  if (notification.type === "critical_reorder" && daysOfSupply !== null) {
    return `${formatNumber(daysOfSupply)} days of supply remaining`;
  }

  if (notification.type === "amber_reorder" && daysOfSupply !== null) {
    return `${formatNumber(daysOfSupply)} days of supply remaining`;
  }

  if (notification.type === "daily_digest") {
    const count = typeof payload.alert_count === "number" ? payload.alert_count : 0;
    return `${count} inventory ${count === 1 ? "alert" : "alerts"} in daily digest`;
  }

  if (notification.type === "weekly_insight") {
    return typeof payload.week_of === "string"
      ? `Weekly inventory insights for ${payload.week_of}`
      : "Weekly inventory insights are ready";
  }

  if (notification.type === "csv_upload_completed") {
    return "Dispensing history upload completed";
  }

  if (notification.type === "csv_upload_failed") {
    return "Dispensing history upload needs attention";
  }

  if (notification.type === "purchase_order_draft") {
    return "Purchase order draft is ready";
  }

  if (notification.type === "DRUG_DISCONTINUED") {
    return "Drug status update requires review";
  }

  return "Notification received";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 1 }).format(value);
}
