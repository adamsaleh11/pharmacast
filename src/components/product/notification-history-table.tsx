"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { listNotifications, notificationHistoryQueryKey } from "@/lib/api/notifications";
import {
  formatRelativeTime,
  notificationDetail,
  notificationDisplay,
  notificationTitle,
  sentTimestamp
} from "@/lib/notifications/display";
import { cn } from "@/lib/utils";

type NotificationHistoryTableProps = {
  organizationId: string | null | undefined;
  getAccessToken: (label: string) => Promise<string>;
};

export function NotificationHistoryTable({ organizationId, getAccessToken }: NotificationHistoryTableProps) {
  const historyQuery = useQuery({
    queryKey: notificationHistoryQueryKey(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const accessToken = await getAccessToken("notification-history");
      return listNotifications(organizationId ?? "", accessToken);
    }
  });

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {historyQuery.isLoading ? (
        <div className="flex items-center gap-2 p-4 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading notifications...
        </div>
      ) : historyQuery.error ? (
        <div className="p-4 text-sm text-red-700">Unable to load notifications.</div>
      ) : (historyQuery.data ?? []).length === 0 ? (
        <div className="p-4 text-sm text-slate-600">No notifications sent yet.</div>
      ) : (
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Detail</th>
              <th className="px-4 py-3 text-left font-medium">Sent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {(historyQuery.data ?? []).map((notification, index) => {
              const meta = notificationDisplay[notification.type];
              const Icon = meta.Icon;

              return (
                <tr key={notification.id ?? `${notification.type}-${index}`}>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full border",
                          meta.toneClassName
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="block font-medium text-slate-900">{notificationTitle(notification)}</span>
                    <span className="block text-slate-600">{notificationDetail(notification)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatRelativeTime(sentTimestamp(notification))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
