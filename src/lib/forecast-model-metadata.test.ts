import { describe, expect, it } from "vitest";
import {
  formatForecastModelPathCountEntries,
  formatForecastModelPathLabel,
  getUploadModelMetadata
} from "./forecast-model-metadata";

describe("forecast model metadata helpers", () => {
  it("formats known and missing model paths for display", () => {
    expect(formatForecastModelPathLabel("prophet")).toBe("Prophet");
    expect(formatForecastModelPathLabel("xgboost_residual_interval")).toBe("XGBoost residual interval");
    expect(formatForecastModelPathLabel(undefined)).toBe("Unknown model");
    expect(formatForecastModelPathLabel("custom_model")).toBe("custom_model");
  });

  it("prefers explicit upload metadata over legacy validationSummary payloads", () => {
    const upload = {
      backtestModelVersion: "v2.1.0",
      backtestModelPathCounts: {
        prophet: 4,
        xgboost_residual_interval: 72,
        ignored: "nope"
      },
      validationSummary: JSON.stringify({
        backtest: {
          model_version: "legacy-v1",
          model_path_counts: {
            prophet: 1
          }
        }
      })
    };

    const metadata = getUploadModelMetadata(upload);

    expect(metadata.backtestModelVersion).toBe("v2.1.0");
    expect(metadata.backtestModelPathCounts).toEqual({
      prophet: 4,
      xgboost_residual_interval: 72
    });
    expect(formatForecastModelPathCountEntries(metadata.backtestModelPathCounts)).toEqual([
      "Prophet: 4",
      "XGBoost residual interval: 72"
    ]);
  });
});
