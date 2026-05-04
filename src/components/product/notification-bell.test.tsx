import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "@/components/product/notification-bell";
import { listNotifications, markAllNotificationsRead } from "@/lib/api/notifications";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock })
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn(() => ({}))
}));

vi.mock("@/lib/supabase/session", () => ({
  getBackendAccessToken: vi.fn(async () => "access-token")
}));

vi.mock("@/lib/api/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/notifications")>();
  return {
    ...actual,
    listNotifications: vi.fn(),
    markAllNotificationsRead: vi.fn()
  };
});

function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationBell organizationId="org-1" />
    </QueryClientProvider>
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides the badge when there are no unread notifications", async () => {
    vi.mocked(listNotifications).mockResolvedValue([]);

    renderBell();

    await waitFor(() => expect(listNotifications).toHaveBeenCalledWith("org-1", "access-token", { unread: true }));
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows 9+ for more than nine unread notifications", async () => {
    vi.mocked(listNotifications).mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        id: `notification-${index}`,
        organization_id: "org-1",
        location_id: "location-1",
        type: "critical_reorder" as const,
        payload: JSON.stringify({
          din: `0000000${index}`,
          drug_name: "Metformin",
          strength: "500mg",
          days_of_supply: 3
        }),
        sent_at: "2026-04-24T10:00:00Z",
        read_at: null,
        created_at: "2026-04-24T10:00:00Z"
      }))
    );

    renderBell();

    expect(await screen.findByText("9+")).toBeInTheDocument();
  });

  it("navigates from a notification and marks all read", async () => {
    const user = userEvent.setup();
    vi.mocked(listNotifications).mockResolvedValue([
      {
        id: "notification-1",
        organization_id: "org-1",
        location_id: "location-1",
        type: "critical_reorder",
        payload: JSON.stringify({
          din: "00012345",
          drug_name: "Metformin",
          strength: "500mg",
          days_of_supply: 3
        }),
        sent_at: "2026-04-24T10:00:00Z",
        read_at: null,
        created_at: "2026-04-24T10:00:00Z"
      }
    ]);
    vi.mocked(markAllNotificationsRead).mockResolvedValue(undefined);

    renderBell();

    await user.click(await screen.findByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("Metformin 500mg")).toBeInTheDocument();

    await user.click(screen.getByText("Metformin 500mg"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard?drug=00012345");

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(await screen.findByRole("button", { name: /Mark all read/i }));
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledWith("org-1", "access-token"));
  });
});
