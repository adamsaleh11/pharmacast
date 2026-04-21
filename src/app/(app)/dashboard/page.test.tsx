import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";
import { ApiError } from "@/lib/api/client";
import { getDrugDetail } from "@/lib/api/drug-detail";

let currentPathname = "/dashboard";
let currentSearch = "";

const pushMock = vi.fn((url: string) => {
  const [pathname, search = ""] = url.split("?");
  currentPathname = pathname;
  currentSearch = search;
});

const replaceMock = vi.fn((url: string) => {
  const [pathname, search = ""] = url.split("?");
  currentPathname = pathname;
  currentSearch = search;
});

vi.mock("@/providers/app-context", () => ({
  useAppContext: vi.fn(() => ({
    currentLocation: { id: "location-1", name: "Main", address: "1 Main" }
  }))
}));

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn()
  }),
  useSearchParams: () => new URLSearchParams(currentSearch)
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn(() => ({}))
}));

vi.mock("@/lib/supabase/session", () => ({
  getBackendAccessToken: vi.fn(async () => "access-token")
}));

vi.mock("@/hooks/use-drug-metadata", () => ({
  useDrugMetadataMap: vi.fn(() => new Map())
}));

vi.mock("@/lib/api/upload", () => ({
  listUploads: vi.fn().mockResolvedValue([])
}));

vi.mock("@/lib/api/drug-detail", () => ({
  drugDetailQueryKey: vi.fn((locationId: string | null | undefined, din: string | null | undefined) => [
    "drug-detail",
    locationId,
    din
  ]),
  getDrugDetail: vi.fn().mockResolvedValue({
    drug: {
      din: "00012345",
      name: "ATORVASTATIN",
      strength: "20 MG",
      form: "TABLET",
      therapeutic_class: "LIPID MODIFYING AGENTS",
      manufacturer: "APOTEX INC",
      status: "MARKETED"
    },
    current_stock: 24,
    stock_last_updated: "2026-04-20T09:15:00Z",
    latest_forecast: {
      din: "00012345",
      generated_at: "2026-04-20T12:00:00Z",
      forecast_horizon_days: 7,
      predicted_quantity: 12,
      model_path: "prophet",
      confidence: "HIGH",
      days_of_supply: 4.5,
      reorder_status: "RED",
      prophet_lower: 10,
      prophet_upper: 15,
      avg_daily_demand: 2,
      reorder_point: 6,
      data_points_used: 21
    },
    threshold: null,
    dispensing_history: [
      { week: "2026-04-20", quantity: 8 },
      { week: "2026-04-13", quantity: 6 }
    ],
    stock_adjustments: [
      {
        adjusted_at: "2026-04-19T10:00:00Z",
        adjustment_quantity: 3,
        note: "Cycle count correction"
      }
    ]
  }),
  upsertDrugThreshold: vi.fn().mockResolvedValue({
    lead_time_days: 2,
    red_threshold_days: 3,
    amber_threshold_days: 7,
    safety_multiplier: "BALANCED",
    notifications_enabled: true
  }),
  resetDrugThreshold: vi.fn().mockResolvedValue(undefined),
  createStockAdjustment: vi.fn().mockResolvedValue({
    adjustment: {
      adjusted_at: "2026-04-21T12:00:00Z",
      adjustment_quantity: -2,
      note: "Broken box removed"
    }
  })
}));

const mockGetDrugDetail = vi.mocked(getDrugDetail);

vi.mock("@/lib/api/forecast-dashboard", () => ({
  listForecasts: vi.fn().mockResolvedValue({
    forecasts: [
      {
        din: "00012345",
        drug_name: "ATORVASTATIN",
        strength: "20 MG",
        predicted_quantity: 12,
        model_path: "xgboost_residual_interval",
        confidence: "HIGH",
        days_of_supply: 2.5,
        reorder_status: "RED",
        generated_at: "2026-04-20T12:00:00Z",
        data_points_used: 24,
        current_stock: null,
        stock_entered: false,
        threshold: null
      }
    ],
    warnings: []
  }),
  listCurrentStock: vi.fn().mockResolvedValue([
    { din: "00012345", quantity: 0, updated_at: "2026-04-20T12:10:00Z" },
    { din: "00067890", quantity: 8, updated_at: "2026-04-20T12:11:00Z" }
  ]),
  listLocationDrugs: vi.fn().mockResolvedValue({ drugs: [] }),
  upsertCurrentStock: vi.fn().mockImplementation(async (_locationId, din, quantity) => ({
    din,
    quantity,
    updated_at: "2026-04-20T13:00:00Z"
  })),
  generateForecast: vi.fn().mockResolvedValue({
    din: "00067890",
    location_id: "location-1",
    horizon_days: 14,
    predicted_quantity: 5,
    model_path: "fallback_recent_trend",
    prophet_lower: 4,
    prophet_upper: 6,
    confidence: "MEDIUM",
    days_of_supply: 8,
    avg_daily_demand: 0.9,
    reorder_status: "GREEN",
    generated_at: "2026-04-20T13:00:00Z",
    reorder_point: 3,
    data_points_used: 18
  }),
  explainForecast: vi.fn().mockResolvedValue({ explanation: "Forecast demand is stable." }),
  streamBatchForecast: vi.fn()
}));

afterEach(() => {
  vi.restoreAllMocks();
  currentPathname = "/dashboard";
  currentSearch = "";
});

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>
  );
}

describe("Dashboard route", () => {
  it("renders the current stock last-modified time", async () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-04-20T13:05:00Z").getTime());

    renderDashboard();

    expect(await screen.findByText("0 units")).toBeInTheDocument();
    expect(screen.getByText("Updated 55 min ago")).toBeInTheDocument();
  });

  it("renders the dashboard with forecast data", async () => {
    renderDashboard();

    expect(await screen.findByText("Tracked Drugs")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Missing Stock")).toBeInTheDocument();
  });

  it("loads and displays drug rows from API", async () => {
    renderDashboard();

    expect(await screen.findByText("00012345")).toBeInTheDocument();
    expect(screen.getByText("ATORVASTATIN 20 MG")).toBeInTheDocument();
  });

  it("updates the model badge after generating a forecast for a table row", async () => {
    const user = userEvent.setup();

    renderDashboard();

    const generateButton = await screen.findByRole("button", { name: "Generate" });
    await user.click(generateButton);

    expect(await screen.findByText("Model: Recent trend fallback")).toBeInTheDocument();
  });

  it("opens the drug detail panel from the route query", async () => {
    currentSearch = "drug=00012345";

    renderDashboard();

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("Current Stock")).toBeInTheDocument();
    expect(screen.getByText("Model: Prophet")).toBeInTheDocument();
    expect(screen.getByText("Model: XGBoost residual interval")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("shows a fallback state when the drug detail endpoint returns 404", async () => {
    mockGetDrugDetail.mockRejectedValueOnce(new ApiError("API request failed with status 404.", 404));
    currentSearch = "drug=02525356";

    renderDashboard();

    expect(await screen.findByText("Drug detail unavailable.")).toBeInTheDocument();
    expect(screen.queryByText("Unable to load drug detail.")).toBeNull();
  });

  it("updates the route when a row is clicked", async () => {
    const user = userEvent.setup();

    const { rerender } = renderDashboard();

    await screen.findByText("ATORVASTATIN 20 MG");
    await user.click(screen.getByText("ATORVASTATIN 20 MG"));

    expect(pushMock).toHaveBeenCalledWith("/dashboard?drug=00012345");

    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <DashboardPage />
      </QueryClientProvider>
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("Current Stock")).toBeInTheDocument();
  });

  it("refreshes the displayed timestamp after saving stock", async () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-04-20T13:05:00Z").getTime());
    const user = userEvent.setup();

    renderDashboard();

    const stockButton = await screen.findByRole("button", { name: "0 units" });
    await user.click(stockButton);

    const stockInput = await screen.findByLabelText("Current stock for ATORVASTATIN");
    await user.clear(stockInput);
    await user.type(stockInput, "7");
    await user.keyboard("{Tab}");

    expect(await screen.findByText("Updated 5 min ago")).toBeInTheDocument();
  });
});
