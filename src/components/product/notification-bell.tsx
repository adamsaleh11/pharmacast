"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listNotifications,
  markAllNotificationsRead,
  notificationHistoryQueryKey,
  unreadNotificationsQueryKey
} from "@/lib/api/notifications";
import {
  formatRelativeTime,
  notificationDetail,
  notificationDisplay,
  notificationTarget,
  notificationTitle,
  sentTimestamp
} from "@/lib/notifications/display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";
import { cn } from "@/lib/utils";
import type { NotificationResponse } from "@/types/notification";

type NotificationBellProps = {
  organizationId: string | null | undefined;
};

async function getNotificationAccessToken(label: string) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const accessToken = await getBackendAccessToken(supabase, label);

  if (!accessToken) {
    throw new Error("You must be signed in to view notifications.");
  }

  return accessToken;
}

export function NotificationBell({ organizationId }: NotificationBellProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadQuery = useQuery({
    queryKey: unreadNotificationsQueryKey(organizationId),
    enabled: Boolean(organizationId),
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      const accessToken = await getNotificationAccessToken("notifications-unread");
      return listNotifications(organizationId ?? "", accessToken, { unread: true });
    }
  });

  const unreadCount = unreadQuery.data?.length ?? 0;
  const visibleNotifications = useMemo(() => (unreadQuery.data ?? []).slice(0, 5), [unreadQuery.data]);

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await getNotificationAccessToken("notifications-mark-all-read");
      return markAllNotificationsRead(organizationId ?? "", accessToken);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (organizationId) {
        void queryClient.invalidateQueries({ queryKey: unreadNotificationsQueryKey(organizationId) });
        void queryClient.invalidateQueries({ queryKey: notificationHistoryQueryKey(organizationId) });
      }
    }
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleNavigate(notification: NotificationResponse) {
    setOpen(false);
    router.push(notificationTarget(notification));
  }

  function handleViewAll() {
    setOpen(false);
    router.push("/settings?tab=notifications");
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={unreadCount === 0 || markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
              className="h-8 px-2 text-xs text-pharma-teal"
            >
              {markAllReadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              Mark all read
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {unreadQuery.isLoading ? (
              <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading notifications...
              </div>
            ) : unreadQuery.error ? (
              <div className="px-4 py-5 text-sm text-red-700">Unable to load notifications.</div>
            ) : visibleNotifications.length === 0 ? (
              <div className="px-4 py-5 text-sm text-slate-600">No unread notifications.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleNotifications.map((notification, index) => (
                  <NotificationPopoverItem
                    key={notification.id ?? `${notification.type}-${index}`}
                    notification={notification}
                    onClick={() => handleNavigate(notification)}
                  />
                ))}
              </div>
            )}
          </div>

          {markAllReadMutation.error ? (
            <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
              Unable to mark notifications read.
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleViewAll}
            className="flex w-full items-center justify-center border-t border-slate-200 px-4 py-3 text-sm font-medium text-pharma-teal hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View all →
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NotificationPopoverItem({
  notification,
  onClick
}: {
  notification: NotificationResponse;
  onClick: () => void;
}) {
  const meta = notificationDisplay[notification.type];
  const Icon = meta.Icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
          meta.toneClassName
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{notificationTitle(notification)}</span>
        <span className="block truncate text-xs text-slate-600">{notificationDetail(notification)}</span>
        <span className="mt-1 block text-xs text-slate-500">{formatRelativeTime(sentTimestamp(notification))}</span>
      </span>
    </button>
  );
}
