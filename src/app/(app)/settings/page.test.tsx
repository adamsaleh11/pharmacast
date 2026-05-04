import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn()
  })
}));

vi.mock("@/providers/app-context", () => ({
  useAppContext: vi.fn(() => ({
    user: { id: "user-1", email: "owner@example.com", role: "owner" },
    organization: { id: "org-1", name: "Organization" },
    currentLocation: { id: "location-1", name: "Main", address: "1 Main" }
  }))
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn(() => ({}))
}));

vi.mock("@/lib/supabase/session", () => ({
  getBackendAccessToken: vi.fn(async () => "access-token")
}));

vi.mock("@/lib/api/purchase-orders", () => ({
  listPurchaseOrders: vi.fn().mockResolvedValue([
    {
      orderId: "order-1",
      generated_at: "2026-04-20T14:00:00Z",
      status: "sent",
      item_count: 4,
      total_units: 18
    }
  ]),
  getPurchaseOrder: vi.fn().mockResolvedValue({
    orderId: "order-1",
    generated_at: "2026-04-20T14:00:00Z",
    order_text: "Order draft summary",
    line_items: [
      {
        din: "00012345",
        drug_name: "ATORVASTATIN",
        strength: "20 MG",
        form: "TABLET",
        current_stock: 24,
        predicted_quantity: 12,
        recommended_quantity: 15,
        days_of_supply: 4.5,
        reorder_status: "RED",
        avg_daily_demand: 2,
        lead_time_days: 2,
        quantity_to_order: 15,
        priority: "URGENT"
      }
    ]
  }),
  downloadPurchaseOrderCsv: vi.fn(),
  downloadPurchaseOrderPdf: vi.fn(),
  previewPurchaseOrder: vi.fn(),
  generatePurchaseOrder: vi.fn(),
  updatePurchaseOrder: vi.fn(),
  sendPurchaseOrder: vi.fn()
}));

vi.mock("@/lib/api/notifications", () => ({
  notificationHistoryQueryKey: (organizationId: string | null | undefined) => ["notifications", "history", organizationId],
  listNotifications: vi.fn().mockResolvedValue([]),
  getNotificationSettings: vi.fn().mockResolvedValue({
    organization_id: "org-1",
    daily_digest_enabled: true,
    weekly_insights_enabled: true,
    critical_alerts_enabled: true
  }),
  updateNotificationSettings: vi.fn().mockResolvedValue({
    organization_id: "org-1",
    daily_digest_enabled: true,
    weekly_insights_enabled: true,
    critical_alerts_enabled: true
  })
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>
  );
}

describe("Settings route", () => {
  it("shows the Orders tab for a signed-in user and lists purchase orders", async () => {
    const user = userEvent.setup();

    renderSettings();

    await user.click(await screen.findByRole("button", { name: "Orders" }));

    await waitFor(() => expect(screen.getByText("Purchase Orders")).toBeInTheDocument());
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CSV" })).toBeInTheDocument();
  }, 10000);

  it("opens an existing order for editing from the Orders tab", async () => {
    const user = userEvent.setup();

    renderSettings();

    await user.click(await screen.findByRole("button", { name: "Orders" }));
    await user.click(await screen.findByRole("button", { name: "Edit" }));

    expect(await screen.findByText("Purchase Order Draft")).toBeInTheDocument();
    expect(screen.getByText("ATORVASTATIN 20 MG TABLET")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Order" })).toBeInTheDocument();
  }, 10000);
});
