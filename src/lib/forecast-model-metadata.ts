import { parseValidationSummary } from "@/lib/upload-summary";

export const FORECAST_MODEL_PATHS = [
  "xgboost_residual_interval",
  "fallback_recent_trend",
  "fallback_unsafe_xgboost_output",
  "prophet",
  "fallback_unsafe_prophet_output"
] as const;

export type ForecastModelPath = (typeof FORECAST_MODEL_PATHS)[number];

const FORECAST_MODEL_LABELS: Record<ForecastModelPath, string> = {
  xgboost_residual_interval: "XGBoost residual interval",
  fallback_recent_trend: "Recent trend fallback",
  fallback_unsafe_xgboost_output: "XGBoost fallback",
  prophet: "Prophet",
  fallback_unsafe_prophet_output: "Prophet fallback"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readModelPathCounts(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const entries = Object.entries(value).reduce<Record<string, number>>((result, [key, count]) => {
    if (typeof count === "number" && Number.isFinite(count)) {
      result[key] = count;
    }
    return result;
  }, {});

  return Object.keys(entries).length > 0 ? entries : null;
}

export function formatForecastModelPathLabel(modelPath: string | null | undefined) {
  if (!modelPath) {
    return "Unknown model";
  }

  return FORECAST_MODEL_LABELS[modelPath as ForecastModelPath] ?? modelPath;
}

export function formatForecastModelPathCountEntries(counts: Record<string, number> | null | undefined) {
  if (!counts) {
    return [];
  }

  return Object.entries(counts)
    .filter(([, count]) => typeof count === "number" && Number.isFinite(count))
    .map(([path, count]) => `${formatForecastModelPathLabel(path)}: ${count}`);
}

export function getUploadModelMetadata(upload: {
  backtestModelVersion?: unknown;
  backtestModelPathCounts?: unknown;
  validationSummary?: unknown;
}) {
  const explicitVersion = readNullableString(upload.backtestModelVersion);
  const explicitPathCounts = readModelPathCounts(upload.backtestModelPathCounts);

  if (explicitVersion || explicitPathCounts) {
    return {
      backtestModelVersion: explicitVersion,
      backtestModelPathCounts: explicitPathCounts
    };
  }

  const legacySummary = parseValidationSummary(upload.validationSummary);
  const legacyBacktest = legacySummary?.backtest ?? null;

  if (!legacyBacktest) {
    return {
      backtestModelVersion: null,
      backtestModelPathCounts: null
    };
  }

  return {
    backtestModelVersion: readNullableString(legacyBacktest.model_version),
    backtestModelPathCounts: readModelPathCounts(legacyBacktest.model_path_counts)
  };
}
