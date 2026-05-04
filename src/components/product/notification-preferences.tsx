"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BarChart3, Check, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getNotificationSettings, updateNotificationSettings } from "@/lib/api/notifications";
import type { NotificationSettingsRequest } from "@/types/notification";

type PreferenceKey = keyof NotificationSettingsRequest;

type NotificationPreferencesProps = {
  organizationId: string | null | undefined;
  canUpdate: boolean;
  getAccessToken: (label: string) => Promise<string>;
};

const preferenceItems: Array<{
  key: PreferenceKey;
  title: string;
  description: string;
  Icon: typeof AlertCircle;
}> = [
  {
    key: "critical_alerts_enabled",
    title: "Critical stock alerts",
    description: "Immediate email when a drug reaches critical stock level",
    Icon: AlertCircle
  },
  {
    key: "daily_digest_enabled",
    title: "Daily morning digest",
    description: "7 AM summary of your inventory status",
    Icon: BarChart3
  },
  {
    key: "weekly_insights_enabled",
    title: "Weekly insights email",
    description: "Monday morning summary with trends and savings",
    Icon: BarChart3
  }
];

const defaultSettings: NotificationSettingsRequest = {
  critical_alerts_enabled: true,
  daily_digest_enabled: true,
  weekly_insights_enabled: true
};

export function NotificationPreferences({
  organizationId,
  canUpdate,
  getAccessToken
}: NotificationPreferencesProps) {
  const [localSettings, setLocalSettings] = useState<NotificationSettingsRequest | null>(null);
  const [savingKey, setSavingKey] = useState<PreferenceKey | null>(null);
  const [savedKey, setSavedKey] = useState<PreferenceKey | null>(null);
  const [errorKey, setErrorKey] = useState<PreferenceKey | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["notification-settings", organizationId] as const,
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const accessToken = await getAccessToken("notification-settings");
      return getNotificationSettings(organizationId ?? "", accessToken);
    }
  });

  const settings: NotificationSettingsRequest = localSettings
    ?? (settingsQuery.data
      ? {
          critical_alerts_enabled: settingsQuery.data.critical_alerts_enabled,
          daily_digest_enabled: settingsQuery.data.daily_digest_enabled,
          weekly_insights_enabled: settingsQuery.data.weekly_insights_enabled
        }
      : defaultSettings);

  useEffect(() => {
    if (!savedKey) {
      return;
    }

    const timeout = window.setTimeout(() => setSavedKey(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [savedKey]);

  async function handleToggle(key: PreferenceKey, checked: boolean) {
    if (!organizationId || !canUpdate || savingKey || settingsQuery.isLoading) {
      return;
    }

    const previousSettings = settings;
    const nextSettings = { ...settings, [key]: checked };
    setLocalSettings(nextSettings);
    setSavingKey(key);
    setSavedKey(null);
    setErrorKey(null);

    try {
      const accessToken = await getAccessToken("notification-settings-update");
      const response = await updateNotificationSettings(organizationId, nextSettings, accessToken);
      setLocalSettings({
        critical_alerts_enabled: response.critical_alerts_enabled,
        daily_digest_enabled: response.daily_digest_enabled,
        weekly_insights_enabled: response.weekly_insights_enabled
      });
      setSavedKey(key);
    } catch {
      setLocalSettings(previousSettings);
      setErrorKey(key);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {settingsQuery.isLoading ? (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading preferences...
        </div>
      ) : null}
      {settingsQuery.error ? (
        <div className="px-4 py-3 text-sm text-red-700">
          Unable to load saved preferences. Defaults are shown until the settings can be refreshed.
        </div>
      ) : null}
      {preferenceItems.map((item) => {
        const Icon = item.Icon;
        const isSaving = savingKey === item.key;
        const isSaved = savedKey === item.key;
        const hasError = errorKey === item.key;

        return (
          <div key={item.key} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-50 text-pharma-teal">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                  {isSaving ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      Saving
                    </span>
                  ) : null}
                  {isSaved ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-pharma-teal">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      Saved
                    </span>
                  ) : null}
                  {hasError ? <span className="text-xs font-medium text-red-700">Not saved</span> : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              </div>
            </div>
            <Switch
              checked={settings[item.key]}
              disabled={!organizationId || !canUpdate || settingsQuery.isLoading || isSaving || Boolean(savingKey)}
              onCheckedChange={(checked) => void handleToggle(item.key, checked)}
              aria-label={item.title}
            />
          </div>
        );
      })}
      {!canUpdate ? (
        <div className="bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Only owners and admins can change notification preferences.
        </div>
      ) : null}
    </div>
  );
}
