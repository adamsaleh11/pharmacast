import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DrugDetailPanel } from "./drug-detail-panel";
import * as drugDetailApi from "@/lib/api/drug-detail";
import type { DrugDetailResponse } from "@/types/drug-detail";

// Mock dependencies
vi.mock("@/lib/api/drug-detail");
vi.mock("@/lib/api/forecast-dashboard");
vi.mock("@/lib/supabase/client");
vi.mock("@/lib/supabase/session");
vi.mock("@/hooks/use-forecast-explanation");

function createMockDrugDetail(overrides: Partial<DrugDetailResponse> = {}): DrugDetailResponse {
  return {
    drug: {
      din: "02242903",
      name: "ATORVASTATIN",
      strength: "20 MG",
      form: "TABLET",
      therapeutic_class: "LIPID MODIFYING AGENTS",
      manufacturer: "APOTEX INC",
      status: "MARKETED"
    },
    current_stock: 500,
    stock_last_updated: new Date().toISOString(),
    latest_forecast: {
      din: "02242903",
      generated_at: new Date().toISOString(),
      forecast_horizon_days: 28,
      predicted_quantity: 1400,
      model_path: "xgboost",
      confidence: "HIGH",
      days_of_supply: 14,
      reorder_status: "GREEN",
      prophet_lower: 1200,
      prophet_upper: 1600,
      avg_daily_demand: 100,
      reorder_point: 300,
      data_points_used: 52
    },
    threshold: {
      lead_time_days: 2,
      red_threshold_days: 3,
      amber_threshold_days: 7,
      safety_multiplier: "BALANCED",
      notifications_enabled: true
    },
    dispensing_history: [
      { week: "2026-01-01", quantity: 98 },
      { week: "2026-01-08", quantity: 102 },
      { week: "2026-01-15", quantity: 99 }
    ],
    stock_adjustments: [
      {
        adjusted_at: new Date(Date.now() - 86400000).toISOString(),
        adjustment_quantity: 50,
        note: "Received from supplier"
      }
    ],
    ...overrides
  };
}

describe("DrugDetailPanel - Phase 1: Panel Shell", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    vi.clearAllMocks();
  });

  function renderPanel(props: Partial<React.ComponentProps<typeof DrugDetailPanel>> = {}) {
    const defaultProps: React.ComponentProps<typeof DrugDetailPanel> = {
      open: true,
      locationId: "loc-123",
      din: "02242903",
      horizonDays: 28,
      onOpenChange: vi.fn(),
      explanationExpanded: false,
      onExplanationExpandedChange: vi.fn(),
      ...props
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <DrugDetailPanel {...defaultProps} />
      </QueryClientProvider>
    );
  }

  it("applies slideIn animation when panel opens", () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(createMockDrugDetail());

    const { container } = renderPanel();
    const sheetContent = container.querySelector('[class*="SheetContent"]');

    expect(sheetContent).toHaveClass("animate-slideIn");
  });

  it("displays panel at max-width of 760px on desktop", () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(createMockDrugDetail());

    const { container } = renderPanel();
    const sheetContent = container.querySelector('[class*="SheetContent"]');

    expect(sheetContent).toHaveClass("max-w-[760px]");
  });

  it("renders drug name and strength in header", async () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(createMockDrugDetail());

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText("ATORVASTATIN 20 MG")).toBeInTheDocument();
    });
  });

  it("renders Health Canada DPD link with correct URL", async () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(createMockDrugDetail());

    renderPanel();

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /02242903/i }) as HTMLAnchorElement;
      expect(link).toHaveAttribute(
        "href",
        "https://health-products.canada.ca/dpd-bdpp/info.do?lang=en&code=02242903"
      );
      expect(link).toHaveAttribute("target", "_new");
    });
  });

  it("displays colored pill icon based on reorder_status", async () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(
      createMockDrugDetail({ latest_forecast: { reorder_status: "RED" } as any })
    );

    renderPanel();

    await waitFor(() => {
      const pill = screen.getByTestId("reorder-status-pill");
      expect(pill).toHaveClass("bg-red-600");
    });
  });

  it("renders three tabs (Overview, Thresholds, Adjustments) in secondary header", async () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(createMockDrugDetail());

    renderPanel();

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /thresholds/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /adjustments/i })).toBeInTheDocument();
    });
  });

  it("displays generated timestamp in secondary header", async () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(createMockDrugDetail());

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/generated|ago/i)).toBeInTheDocument();
    });
  });

  it("closes panel when close button is clicked", async () => {
    const onOpenChange = vi.fn();
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(createMockDrugDetail());

    renderPanel({ onOpenChange });

    await waitFor(() => {
      const closeButton = screen.getByLabelText(/close drug detail panel/i);
      fireEvent.click(closeButton);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("renders loading state with spinner", () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderPanel();

    expect(screen.getByText(/loading drug detail/i)).toBeInTheDocument();
  });

  it("renders error state with retry button", async () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockRejectedValue(new Error("Network error"));

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/unable to load drug detail/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  it("renders null state when drug detail unavailable", async () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(null as any);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/drug detail unavailable/i)).toBeInTheDocument();
    });
  });
});

describe("DrugDetailPanel - Phase 2: Overview Tab", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  function renderPanel(props: Partial<React.ComponentProps<typeof DrugDetailPanel>> = {}) {
    const defaultProps: React.ComponentProps<typeof DrugDetailPanel> = {
      open: true,
      locationId: "loc-123",
      din: "02242903",
      horizonDays: 28,
      onOpenChange: vi.fn(),
      explanationExpanded: false,
      onExplanationExpandedChange: vi.fn(),
      ...props
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <DrugDetailPanel {...defaultProps} />
      </QueryClientProvider>
    );
  }

  it("renders metadata strip with four tiles", async () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(createMockDrugDetail());

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/LIPID MODIFYING AGENTS/i)).toBeInTheDocument();
      expect(screen.getByText(/TABLET/i)).toBeInTheDocument();
      expect(screen.getByText(/20 MG/i)).toBeInTheDocument();
      expect(screen.getByText(/MARKETED/i)).toBeInTheDocument();
    });
  });

  it("displays current stock in large mono font", async () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(
      createMockDrugDetail({ current_stock: 500 })
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/500 units/i)).toBeInTheDocument();
    });
  });

  it("shows red left-bar accent on stock card when reorder_status is RED", async () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(
      createMockDrugDetail({
        latest_forecast: {
          reorder_status: "RED"
        } as any
      })
    );

    const { container } = renderPanel();

    await waitFor(() => {
      const stockCard = screen.getByText(/current stock/i).closest("[class*='Card']");
      expect(stockCard).toHaveClass("border-red-300");
      expect(stockCard).toHaveClass("bg-red-50");
    });
  });

  it("displays relative timestamp for last stock update", async () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(
      createMockDrugDetail({
        stock_last_updated: oneHourAgo.toISOString()
      })
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/1 hours ago|Updated/i)).toBeInTheDocument();
    });
  });
});

describe("DrugDetailPanel - Phase 3: Forecast Card", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  function renderPanel(props: Partial<React.ComponentProps<typeof DrugDetailPanel>> = {}) {
    const defaultProps: React.ComponentProps<typeof DrugDetailPanel> = {
      open: true,
      locationId: "loc-123",
      din: "02242903",
      horizonDays: 28,
      onOpenChange: vi.fn(),
      explanationExpanded: false,
      onExplanationExpandedChange: vi.fn(),
      ...props
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <DrugDetailPanel {...defaultProps} />
      </QueryClientProvider>
    );
  }

  it("displays forecast stat blocks with correct values", async () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(createMockDrugDetail());

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/14(\.\d+)?\s+days/)).toBeInTheDocument();
      expect(screen.getByText(/1400 units/)).toBeInTheDocument();
      expect(screen.getByText(/100 units/)).toBeInTheDocument();
    });
  });

  it("displays RED alert banner when reorder_status is RED", async () => {
    const leadTime = 3;
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(
      createMockDrugDetail({
        latest_forecast: {
          reorder_status: "RED",
          days_of_supply: 2
        } as any,
        threshold: {
          lead_time_days: leadTime
        } as any
      })
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/Stockout in 2 day/i)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(`Lead time ${leadTime}d`, "i"))).toBeInTheDocument();
    });
  });

  it("does not show alert banner for GREEN or AMBER status", async () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(
      createMockDrugDetail({
        latest_forecast: {
          reorder_status: "GREEN"
        } as any
      })
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.queryByText(/Stockout in/i)).not.toBeInTheDocument();
    });
  });

  it("applies urgentPulse animation to RED forecast card", async () => {
    vi.mocked(drugDetailApi.getDrugDetail).mockResolvedValue(
      createMockDrugDetail({
        latest_forecast: {
          reorder_status: "RED"
        } as any
      })
    );

    const { container } = renderPanel();

    await waitFor(() => {
      const forecastCard = screen.getByText(/Forecast/i).closest("[class*='Card']");
      expect(forecastCard).toHaveClass("animate-urgentPulse");
    });
  });
});
