import type { BacktestStatus, UploadBacktestSummary, ValidationSummary } from "@/types/upload";

type ValidationSummaryLike = ValidationSummary | null | undefined;

const BACKTEST_COPY: Record<
  BacktestStatus | "MISSING",
  { title: string; description: string; badgeLabel: string; tone: "success" | "warning" | "danger" | "muted" }
> = {
  PASS: {
    title: "Forecast-ready",
    description: "This upload has enough history and passed the forecast quality check.",
    badgeLabel: "Ready",
    tone: "success"
  },
  LOW_CONFIDENCE: {
    title: "Forecast caution",
    description: "Forecasts can be generated, but accuracy may be lower for this upload.",
    badgeLabel: "Caution",
    tone: "warning"
  },
  FAIL: {
    title: "Not forecast-ready",
    description: "This upload does not have enough reliable history for trusted forecasts yet.",
    badgeLabel: "Not ready",
    tone: "danger"
  },
  ERROR: {
    title: "Readiness check unavailable",
    description: "The upload was saved, but the forecast readiness check could not be completed.",
    badgeLabel: "Unavailable",
    tone: "danger"
  },
  MISSING: {
    title: "Forecast readiness pending",
    description: "This upload was saved, but the forecast readiness check is not available yet.",
    badgeLabel: "Pending",
    tone: "muted"
  }
};

const SPECIAL_ERROR_COPY: Record<string, string> = {
  insufficient_backtest_history: "More dispensing history is needed before forecasts can be trusted.",
  forecast_service_not_configured: "Forecast readiness is not configured for this environment.",
  backtest_timeout: "Forecast readiness took too long and timed out.",
  backtest_unavailable: "Forecast readiness is temporarily unavailable.",
  empty_backtest_response: "Forecast readiness returned an empty response."
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseValidationSummary(value: unknown): ValidationSummaryLike {
  if (!value) {
    return null;
  }

  if (isRecord(value)) {
    return value as ValidationSummary;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? (parsed as ValidationSummary) : null;
    } catch {
      return null;
    }
  }

  return null;
}

export function getUploadValidationSummary(upload: { validationSummary?: unknown }) {
  return parseValidationSummary(upload.validationSummary);
}

export function getUploadBacktest(upload: { validationSummary?: unknown }): UploadBacktestSummary | null {
  return getUploadValidationSummary(upload)?.backtest ?? null;
}

export function getBacktestDisplay(backtest: UploadBacktestSummary | null | undefined) {
  if (!backtest) {
    return BACKTEST_COPY.MISSING;
  }

  const base = BACKTEST_COPY[backtest.status] ?? BACKTEST_COPY.MISSING;
  const description =
    backtest.error_message && SPECIAL_ERROR_COPY[backtest.error_message]
      ? SPECIAL_ERROR_COPY[backtest.error_message]
      : base.description;

  return {
    ...base,
    description
  };
}

export function formatBacktestBoolean(value: boolean | null | undefined) {
  if (value === true) {
    return "Better than baseline";
  }

  if (value === false) {
    return "Did not beat baseline";
  }

  return "Not evaluated";
}

export function formatBacktestPercent(value: number | null | undefined, fractionDigits = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat(undefined, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value);
}

export function formatBacktestInteger(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export function formatBacktestDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
