import { describe, expect, it } from "vitest";
import {
  dashboardStats,
  filterAndSortRows,
  mergeDrugRows,
  forecastResultToSummary,
  normalizeForecastResult,
  normalizeForecastSummary,
  parseStockInput,
  resolveGenerationTarget,
  stockResponsesToMap,
  validateStockInput
} from "./model";
import type { DrugRow } from "@/types/forecast-dashboard";
import type { ForecastRowForecast } from "./model";

const forecast = (overrides: Partial<ForecastRowForecast>): ForecastRowForecast => ({
  din: "00012345",
  drug_name: "ATORVASTATIN",
  strength: "20 MG",
  predicted_quantity: 12,
  confidence: "HIGH",
  days_of_supply: 2.4,
  reorder_status: "RED",
  generated_at: "2026-04-20T12:00:00Z",
  current_stock: null,
  stock_entered: false,
  threshold: null,
  prophet_lower: 10,
  prophet_upper: 14,
  avg_daily_demand: 1.7,
  reorder_point: 8,
  data_points_used: 26,
  ...overrides
});

const row = (overrides: Partial<DrugRow>): DrugRow => ({
  din: "00012345",
  drugName: "ATORVASTATIN",
  strength: "20 MG",
  therapeuticClass: "LIPID",
  drugStatus: "MARKETED",
  currentStock: 12,
  stockUpdatedAt: "2026-04-20T12:00:00Z",
  forecast: forecast({}),
  ...overrides
});

describe("forecast dashboard model", () => {
  it("merges the row universe from forecasts and current stock", () => {
    const stockMap = stockResponsesToMap([
      { din: "00012345", quantity: 0, updated_at: "2026-04-20T12:00:00Z" },
      { din: "00067890", quantity: 7, updated_at: "2026-04-20T12:01:00Z" }
    ]);

    const rows = mergeDrugRows([forecast({ din: "00012345" })], stockMap);

    expect(rows.map((candidate) => candidate.din).sort()).toEqual(["00012345", "00067890"]);
    expect(rows.find((candidate) => candidate.din === "00012345")?.currentStock).toBe(0);
  });

  it("counts zero stock as entered in dashboard stats", () => {
    const stats = dashboardStats([
      row({ currentStock: 0, forecast: forecast({ reorder_status: "RED" }) }),
      row({ din: "00067890", currentStock: null, forecast: null })
    ]);

    expect(stats).toEqual({ tracked: 2, red: 1, amber: 0, green: 0, missingStock: 1 });
  });

  it("validates stock input without converting blank input to zero", () => {
    expect(validateStockInput("")).toBeNull();
    expect(parseStockInput("")).toBeNull();
    expect(parseStockInput("0")).toBe(0);
    expect(validateStockInput("-1")).toBe("Quantity cannot be negative");
    expect(validateStockInput("1.5")).toBe("Enter a whole number");
    expect(validateStockInput("1000000")).toBe("Quantity is too large");
  });

  it("resolves all and selected generation targets globally", () => {
    const rows = [
      row({ din: "00012345", currentStock: 5 }),
      row({ din: "00067890", currentStock: null, forecast: null }),
      row({ din: "00022222", currentStock: 0, forecast: null })
    ];

    expect(resolveGenerationTarget(rows, new Set(["00067890", "00022222"]), "selected", new Set())).toEqual({
      targetDins: ["00067890", "00022222"],
      stockedDins: ["00022222"],
      missingStockDins: ["00067890"],
      savingTargetDins: []
    });

    expect(resolveGenerationTarget(rows, new Set(), "all", new Set(["00012345"])).savingTargetDins).toEqual([
      "00012345"
    ]);
  });

  it("filters and sorts rows by the default status priority", () => {
    const rows = [
      row({ din: "green", drugName: "Green", forecast: forecast({ reorder_status: "GREEN" }) }),
      row({ din: "missing", drugName: "Missing", currentStock: null, forecast: null }),
      row({ din: "amber", drugName: "Amber", forecast: forecast({ reorder_status: "AMBER" }) }),
      row({ din: "none", drugName: "None", forecast: null })
    ];

    expect(filterAndSortRows(rows, "", { status: "all", confidence: "all", therapeuticClass: "all" }, "status").map((candidate) => candidate.din)).toEqual([
      "amber",
      "green",
      "none",
      "missing"
    ]);
  });

  it("normalizes forecast list rows without prophet interval fields", () => {
    expect(
      normalizeForecastSummary({
        din: "00012345",
        predicted_quantity: 12,
        model_path: "prophet",
        confidence: "HIGH",
        days_of_supply: 2.4,
        reorder_status: "RED",
        generated_at: "2026-04-20T12:00:00Z",
        data_points_used: 26
      })
    ).toMatchObject({
      din: "00012345",
      model_path: "prophet",
      predicted_quantity: 12,
      reorder_status: "RED"
    });

    expect(
      normalizeForecastSummary({
        din: "00012345",
        drug_name: "ATORVASTATIN",
        strength: "20 MG",
        predicted_quantity: 12,
        model_path: "xgboost_residual_interval",
        confidence: "HIGH",
        days_of_supply: 2.4,
        reorder_status: "RED",
        generated_at: "2026-04-20T12:00:00Z",
        data_points_used: 26,
        current_stock: null,
        stock_entered: false
      })
    ).toMatchObject({
      din: "00012345",
      drug_name: "ATORVASTATIN",
      model_path: "xgboost_residual_interval",
      predicted_quantity: 12
    });

    expect(() =>
      normalizeForecastResult({
        din: "00012345",
        location_id: "location-1",
        horizon_days: 14,
        predicted_quantity: 12,
        confidence: "HIGH",
        days_of_supply: 2.4,
        avg_daily_demand: 1.7,
        reorder_status: "RED",
        reorder_point: 8,
        generated_at: "2026-04-20T12:00:00Z",
        data_points_used: 26
      })
    ).toThrow(/prophet_lower/);
  });

  it("preserves model metadata when a generated forecast is merged into a summary row", () => {
    expect(
      forecastResultToSummary({
        din: "00012345",
        location_id: "location-1",
        horizon_days: 14,
        predicted_quantity: 12,
        model_path: "xgboost_residual_interval",
        prophet_lower: 10,
        prophet_upper: 14,
        confidence: "HIGH",
        days_of_supply: 2.4,
        avg_daily_demand: 1.7,
        reorder_status: "RED",
        reorder_point: 8,
        generated_at: "2026-04-20T12:00:00Z",
        data_points_used: 26
      }).model_path
    ).toBe("xgboost_residual_interval");
  });
});
