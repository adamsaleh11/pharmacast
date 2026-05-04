import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import InsightsPage from "./page";
import {
  getAccuracyInsights,
  getHealthScoreInsights,
  getSavingsInsights,
  getTrendsInsights
} from "@/lib/api/insights";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => <div />,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  PolarAngleAxis: () => <div />,
  RadialBar: () => <div />,
  RadialBarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => <div />,
  YAxis: () => <div />
}));

vi.mock("@/providers/app-context", () => ({
  useAppContext: () => ({
    authReady: true,
    currentLocation: { id: "location-1", name: "Main Street Pharmacy" },
    locations: [{ id: "location-1", name: "Main Street Pharmacy" }],
    organization: { id: "org-1", name: "Org" },
    user: { id: "user-1", email: "owner@example.com", role: "owner" },
    authError: null,
    setCurrentLocation: vi.fn()
  })
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { getSession: vi.fn() } })
}));

vi.mock("@/lib/supabase/session", () => ({
  getBackendAccessToken: vi.fn().mockResolvedValue("access-token")
}));

vi.mock("@/lib/api/insights", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/insights")>();
  return {
    ...actual,
    getSavingsInsights: vi.fn(),
    getAccuracyInsights: vi.fn(),
    getHealthScoreInsights: vi.fn(),
    getTrendsInsights: vi.fn()
  };
});

const mockGetSavingsInsights = vi.mocked(getSavingsInsights);
const mockGetAccuracyInsights = vi.mocked(getAccuracyInsights);
const mockGetHealthScoreInsights = vi.mocked(getHealthScoreInsights);
const mockGetTrendsInsights = vi.mocked(getTrendsInsights);

function renderInsights() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <InsightsPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSavingsInsights.mockResolvedValue({
    period_days: 30,
    total_savings: 0,
    overstock_avoided: {
      value: null,
      requires_cost_data: true
    },
    waste_eliminated: {
      value: null,
      requires_multiple_uploads: true
    },
    stockouts_prevented: {
      count: 0,
      estimated_value: 0
    },
    insufficient_data: true,
    data_quality_message: "Some savings categories require additional cost, upload, or forecast history data."
  });
  mockGetAccuracyInsights.mockResolvedValue({
    overall_accuracy_pct: null,
    by_drug: []
  });
  mockGetHealthScoreInsights.mockResolvedValue({
    score: 72,
    breakdown: {
      stock_health: 30,
      accuracy: 20,
      stockout_reduction: 22
    }
  });
  mockGetTrendsInsights.mockResolvedValue({
    top_growing: [],
    top_declining: [],
    seasonal_peaks: [],
    total_dispensing_trend: []
  });
});

describe("Insights page", () => {
  it("renders zero dollar savings as a real value", async () => {
    renderInsights();

    expect(await screen.findByText("$0")).toBeInTheDocument();
    expect(screen.getByText("Add cost data to unlock")).toBeInTheDocument();
    expect(screen.getByText("Upload more data to unlock")).toBeInTheDocument();
    expect(screen.getByText(/Prevented 0 stockout days/)).toBeInTheDocument();
  });

  it("does not render a dollar value when total savings is null", async () => {
    mockGetSavingsInsights.mockResolvedValueOnce({
      period_days: 30,
      total_savings: null,
      overstock_avoided: {
        value: null,
        requires_cost_data: true
      },
      waste_eliminated: {
        value: null,
        requires_multiple_uploads: true
      },
      stockouts_prevented: {
        count: 1,
        estimated_value: 150
      },
      insufficient_data: true,
      data_quality_message: null
    });

    renderInsights();

    expect(await screen.findByText("Unlock savings tracking")).toBeInTheDocument();
    expect(screen.getByText("Add cost_per_unit to your Kroll export →")).toBeInTheDocument();
  });

  it("shows the data quality banner when the backend provides a message", async () => {
    renderInsights();

    expect(await screen.findByText(/Some savings categories require additional cost/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download Kroll export guide →" })).toHaveAttribute(
      "href",
      "/help/kroll-export"
    );
  });

  it("refetches period-scoped queries when the period changes", async () => {
    const user = userEvent.setup();

    renderInsights();

    await screen.findByText("$0");
    await user.click(screen.getByRole("button", { name: "Last 60 days" }));

    await waitFor(() => {
      expect(mockGetSavingsInsights).toHaveBeenCalledWith("location-1", 60, "access-token");
      expect(mockGetAccuracyInsights).toHaveBeenCalledWith("location-1", 60, "access-token");
      expect(mockGetTrendsInsights).toHaveBeenCalledWith("location-1", 60, "access-token");
    });
    expect(mockGetHealthScoreInsights).toHaveBeenCalledWith("location-1", "access-token");
  });

  it("renders the accuracy empty state when no overall accuracy is available", async () => {
    renderInsights();

    expect(await screen.findByText("Not enough data yet — accuracy improves over time.")).toBeInTheDocument();
  });
});
