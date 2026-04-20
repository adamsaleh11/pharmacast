import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";
import { listUploads } from "@/lib/api/upload";
import {
  generateForecast,
  listCurrentStock,
  listForecasts,
  listLocationDrugs,
  streamBatchForecast,
  upsertCurrentStock
} from "@/lib/api/forecast-dashboard";
import { useDrugMetadataMap } from "@/hooks/use-drug-metadata";
import { useAppContext } from "@/providers/app-context";

vi.mock("@/providers/app-context", () => ({
  useAppContext: vi.fn(() => ({
    currentLocation: { id: "location-1", name: "Main", address: "1 Main" }
  }))
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

vi.mock("@/lib/api/forecast-dashboard", () => ({
  listForecasts: vi.fn().mockResolvedValue([
    {
      din: "00012345",
      drug_name: "ATORVASTATIN",
      strength: "20 MG",
      predicted_quantity: 12,
      confidence: "HIGH",
      days_of_supply: 2.5,
      reorder_status: "RED",
      generated_at: "2026-04-20T12:00:00Z",
      current_stock: null,
      stock_entered: false,
      threshold: null
    }
  ]),
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
    confidence: "MEDIUM",
    days_of_supply: 8,
    reorder_status: "GREEN",
    generated_at: "2026-04-20T13:00:00Z"
  }),
  streamBatchForecast: vi.fn()
}));

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
});