export type NotificationType =
  | "critical_reorder"
  | "amber_reorder"
  | "daily_digest"
  | "weekly_insight"
  | "csv_upload_completed"
  | "csv_upload_failed"
  | "purchase_order_draft"
  | "DRUG_DISCONTINUED";

export type NotificationResponse = {
  id: string | null;
  organization_id: string;
  location_id: string | null;
  type: NotificationType;
  payload: string | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string | null;
};

export type NotificationSettingsRequest = {
  daily_digest_enabled: boolean;
  weekly_insights_enabled: boolean;
  critical_alerts_enabled: boolean;
};

export type NotificationSettingsResponse = NotificationSettingsRequest & {
  organization_id: string;
};

export type ParsedNotificationPayload = {
  din?: string;
  drug_name?: string;
  strength?: string;
  current_stock?: number;
  days_of_supply?: number;
  forecasted_demand_7_days?: number;
  lead_time_days?: number;
  date?: string;
  location_id?: string;
  alert_count?: number;
  week_of?: string;
  [key: string]: unknown;
};
