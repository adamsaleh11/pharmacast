import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationPreferences } from "@/components/product/notification-preferences";
import { getNotificationSettings, updateNotificationSettings } from "@/lib/api/notifications";

vi.mock("@/lib/api/notifications", () => ({
  getNotificationSettings: vi.fn(),
  updateNotificationSettings: vi.fn()
}));

function renderPreferences() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationPreferences
        organizationId="org-1"
        canUpdate
        getAccessToken={vi.fn(async () => "access-token")}
      />
    </QueryClientProvider>
  );
}

describe("NotificationPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNotificationSettings).mockResolvedValue({
      organization_id: "org-1",
      critical_alerts_enabled: true,
      daily_digest_enabled: true,
      weekly_insights_enabled: true
    });
  });

  it("loads saved preferences and optimistically saves a changed preference", async () => {
    const user = userEvent.setup();
    vi.mocked(getNotificationSettings).mockResolvedValue({
      organization_id: "org-1",
      critical_alerts_enabled: true,
      daily_digest_enabled: false,
      weekly_insights_enabled: true
    });
    vi.mocked(updateNotificationSettings).mockResolvedValue({
      organization_id: "org-1",
      critical_alerts_enabled: false,
      daily_digest_enabled: false,
      weekly_insights_enabled: true
    });

    renderPreferences();

    const criticalSwitch = screen.getByRole("switch", { name: "Critical stock alerts" });
    await waitFor(() => expect(screen.getByRole("switch", { name: "Daily morning digest" })).toHaveAttribute("aria-checked", "false"));
    expect(criticalSwitch).toHaveAttribute("aria-checked", "true");

    await user.click(criticalSwitch);

    expect(criticalSwitch).toHaveAttribute("aria-checked", "false");
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
    expect(updateNotificationSettings).toHaveBeenCalledWith(
      "org-1",
      {
        critical_alerts_enabled: false,
        daily_digest_enabled: false,
        weekly_insights_enabled: true
      },
      "access-token"
    );
  });

  it("reverts a changed preference when the save fails", async () => {
    const user = userEvent.setup();
    vi.mocked(updateNotificationSettings).mockRejectedValue(new Error("nope"));

    renderPreferences();

    const digestSwitch = screen.getByRole("switch", { name: "Daily morning digest" });
    await user.click(digestSwitch);

    await waitFor(() => expect(digestSwitch).toHaveAttribute("aria-checked", "true"));
    expect(screen.getByText("Not saved")).toBeInTheDocument();
  });
});
