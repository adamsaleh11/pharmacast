import { describe, expect, it } from "vitest";
import {
  formatBacktestBoolean,
  formatBacktestDateTime,
  formatBacktestInteger,
  formatBacktestPercent,
  getBacktestDisplay,
  getUploadBacktest,
  parseValidationSummary
} from "./upload-summary";
import type { UploadBacktestSummary } from "@/types/upload";

describe("upload-summary helpers", () => {
  it("parses validationSummary from object and string values", () => {
    const objectSummary = parseValidationSummary({
      total_rows: 10,
      unique_dins: 5,
      warnings: [],
      backtest: { status: "PASS" }
    });
    const stringSummary = parseValidationSummary(
      JSON.stringify({
        total_rows: 10,
        unique_dins: 5,
        warnings: [],
        backtest: { status: "PASS" }
      })
    );

    expect(objectSummary?.total_rows).toBe(10);
    expect(stringSummary?.unique_dins).toBe(5);
  });

  it("returns backtest summary safely from upload records", () => {
    const backtest = getUploadBacktest({
      validationSummary: JSON.stringify({
        total_rows: 10,
        unique_dins: 5,
        warnings: [],
        backtest: {
          status: "LOW_CONFIDENCE",
          model_version: "prophet_v1",
          mae: 1.2,
          wape: 0.0183,
          interval_coverage: 0.9166,
          anomaly_count: 0,
          beats_last_7_day_avg: true,
          beats_last_14_day_avg: null,
          baseline_last_7_day_avg_mae: 2.1,
          baseline_last_14_day_avg_mae: 2.5,
          rows_evaluated: 60,
          din_count: 5,
          generated_at: "2026-04-21T05:00:00+00:00",
          error_message: null,
          artifact_path: null
        }
      })
    });

    expect(backtest?.status).toBe("LOW_CONFIDENCE");
    expect(getBacktestDisplay(backtest).title).toBe("Forecast caution");
  });

  it("formats readiness metrics consistently", () => {
    expect(formatBacktestPercent(0.0183)).toBe("1.8%");
    expect(formatBacktestInteger(42)).toBe("42");
    expect(formatBacktestBoolean(true)).toBe("Better than baseline");
    expect(formatBacktestBoolean(false)).toBe("Did not beat baseline");
    expect(formatBacktestDateTime("2026-04-21T05:00:00+00:00")).toContain("2026");
  });

  it("maps special backtest errors to user-facing copy", () => {
    const timeoutBacktest = {
      status: "ERROR",
      model_version: "prophet_v1",
      mae: null,
      wape: null,
      interval_coverage: null,
      anomaly_count: null,
      beats_last_7_day_avg: null,
      beats_last_14_day_avg: null,
      baseline_last_7_day_avg_mae: null,
      baseline_last_14_day_avg_mae: null,
      rows_evaluated: null,
      din_count: null,
      generated_at: "2026-04-21T05:00:00+00:00",
      error_message: "backtest_timeout",
      artifact_path: null
    } satisfies UploadBacktestSummary;

    expect(getBacktestDisplay(timeoutBacktest).description).toBe(
      "Forecast readiness took too long and timed out."
    );
  });
});
