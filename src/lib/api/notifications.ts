import { createApiClient } from "@/lib/api/client";
import type {
  NotificationResponse,
  NotificationSettingsRequest,
  NotificationSettingsResponse,
  ParsedNotificationPayload
} from "@/types/notification";

const apiClient = createApiClient();

export function unreadNotificationsQueryKey(organizationId: string | null | undefined) {
  return ["notifications", "unread", organizationId] as const;
}

export function notificationHistoryQueryKey(organizationId: string | null | undefined) {
  return ["notifications", "history", organizationId] as const;
}

export function listNotifications(
  organizationId: string,
  accessToken: string,
  options: { unread?: boolean } = {}
): Promise<NotificationResponse[]> {
  const query = options.unread ? "?unread=true" : "";
  return apiClient.get<NotificationResponse[]>(`/organizations/${organizationId}/notifications${query}`, {
    accessToken
  });
}

export function updateNotificationSettings(
  organizationId: string,
  body: NotificationSettingsRequest,
  accessToken: string
): Promise<NotificationSettingsResponse> {
  return apiClient.put<NotificationSettingsResponse>(
    `/organizations/${organizationId}/notification-settings`,
    body,
    { accessToken }
  );
}

export function getNotificationSettings(
  organizationId: string,
  accessToken: string
): Promise<NotificationSettingsResponse> {
  return apiClient.get<NotificationSettingsResponse>(
    `/organizations/${organizationId}/notification-settings`,
    { accessToken }
  );
}

export function markAllNotificationsRead(organizationId: string, accessToken: string): Promise<void> {
  return apiClient.put<void>(`/organizations/${organizationId}/notifications/mark-all-read`, undefined, {
    accessToken
  });
}

export function parseNotificationPayload(payload: string | null | undefined): ParsedNotificationPayload {
  if (!payload) {
    return {};
  }

  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ParsedNotificationPayload)
      : {};
  } catch {
    return {};
  }
}
