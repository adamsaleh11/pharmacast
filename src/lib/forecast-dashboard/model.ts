import type {
  BulkMode,
  CurrentStockResponse,
  DrugMetadata,
  DrugRow,
  FilterState,
  ForecastBatchEvent,
  ForecastResult,
  ForecastSummaryDto,
  ReorderStatus,
  SortKey,
  StockEntry
} from "@/types/forecast-dashboard";

export const STOCK_MAX_QUANTITY = 999_999;

export type ForecastRowForecast = ForecastSummaryDto & {
  model_path?: string | null;
  prophet_lower?: number | null;
  prophet_upper?: number | null;
  avg_daily_demand?: number | null;
  reorder_point?: number | null;
  data_points_used?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(value: Record<string, unknown>, field: string, context: string) {
  const candidate = value[field];
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    throw new Error(`${context} is missing required field "${field}".`);
  }
  return candidate;
}

function readNullableStringField(value: Record<string, unknown>, field: string) {
  const candidate = value[field];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate : null;
}

function readNumberField(value: Record<string, unknown>, field: string, context: string) {
  const candidate = value[field];
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    throw new Error(`${context} is missing required field "${field}".`);
  }
  return candidate;
}

function readNullableNumberField(value: Record<string, unknown>, field: string) {
  const candidate = value[field];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
}

function readBooleanField(value: Record<string, unknown>, field: string) {
  const candidate = value[field];
  return typeof candidate === "boolean" ? candidate : false;
}

function readThresholdField(value: Record<string, unknown>) {
  const candidate = value.threshold;
  if (!isRecord(candidate)) {
    return null;
  }

  const leadTimeDays = candidate.lead_time_days;
  const safetyMultiplier = candidate.safety_multiplier;

  if (typeof leadTimeDays !== "number" || !Number.isFinite(leadTimeDays)) {
    return null;
  }

  if (typeof safetyMultiplier !== "number" || !Number.isFinite(safetyMultiplier)) {
    return null;
  }

  const redThresholdDays = typeof candidate.red_threshold_days === "number" && Number.isFinite(candidate.red_threshold_days)
    ? candidate.red_threshold_days
    : undefined;

  const amberThresholdDays = typeof candidate.amber_threshold_days === "number" && Number.isFinite(candidate.amber_threshold_days)
    ? candidate.amber_threshold_days
    : undefined;

  return {
    lead_time_days: leadTimeDays,
    safety_multiplier: safetyMultiplier,
    red_threshold_days: redThresholdDays,
    amber_threshold_days: amberThresholdDays
  };
}

export function normalizeForecastSummary(value: unknown, context = "Forecast response"): ForecastSummaryDto {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object.`);
  }

  return {
    din: readStringField(value, "din", context),
    drug_name: readNullableStringField(value, "drug_name"),
    strength: readNullableStringField(value, "strength"),
    predicted_quantity: readNumberField(value, "predicted_quantity", context),
    model_path: readNullableStringField(value, "model_path"),
    confidence: readStringField(value, "confidence", context),
    days_of_supply: readNumberField(value, "days_of_supply", context),
    reorder_status: readStringField(value, "reorder_status", context),
    generated_at: readStringField(value, "generated_at", context),
    current_stock: readNullableNumberField(value, "current_stock"),
    stock_entered: readBooleanField(value, "stock_entered"),
    threshold: readThresholdField(value)
  };
}

export function normalizeForecastResult(value: unknown, context = "Forecast response"): ForecastResult {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object.`);
  }

  return {
    din: readStringField(value, "din", context),
    location_id: readStringField(value, "location_id", context),
    horizon_days: readNumberField(value, "horizon_days", context),
    predicted_quantity: readNumberField(value, "predicted_quantity", context),
    model_path: readNullableStringField(value, "model_path"),
    prophet_lower: readNumberField(value, "prophet_lower", context),
    prophet_upper: readNumberField(value, "prophet_upper", context),
    confidence: readStringField(value, "confidence", context),
    days_of_supply: readNumberField(value, "days_of_supply", context),
    avg_daily_demand: readNumberField(value, "avg_daily_demand", context),
    reorder_status: readStringField(value, "reorder_status", context),
    reorder_point: readNumberField(value, "reorder_point", context),
    generated_at: readStringField(value, "generated_at", context),
    data_points_used: readNumberField(value, "data_points_used", context)
  };
}

export function stockResponsesToMap(stockRows: CurrentStockResponse[]): Map<string, StockEntry> {
  return new Map(stockRows.map((stock) => [stock.din, { quantity: stock.quantity, updatedAt: stock.updated_at }]));
}

export function validateStockInput(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d+$/.test(trimmed)) {
    return trimmed.startsWith("-") ? "Quantity cannot be negative" : "Enter a whole number";
  }

  const quantity = Number(trimmed);
  if (quantity > STOCK_MAX_QUANTITY) {
    return "Quantity is too large";
  }

  return null;
}

export function parseStockInput(value: string): number | null {
  if (validateStockInput(value)) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

export function forecastResultToSummary(
  result: ForecastResult,
  row?: Pick<DrugRow, "drugName" | "strength" | "currentStock"> | null
): ForecastRowForecast {
  return {
    din: result.din,
    drug_name: row?.drugName ?? null,
    strength: row?.strength ?? null,
    predicted_quantity: result.predicted_quantity,
    model_path: result.model_path ?? null,
    confidence: result.confidence,
    days_of_supply: result.days_of_supply,
    reorder_status: result.reorder_status,
    generated_at: result.generated_at,
    current_stock: row?.currentStock ?? null,
    stock_entered: row ? isStockEntered(row) : false,
    threshold: null,
    prophet_lower: result.prophet_lower,
    prophet_upper: result.prophet_upper,
    avg_daily_demand: result.avg_daily_demand,
    reorder_point: result.reorder_point,
    data_points_used: result.data_points_used
  };
}

export function mergeForecastSummary(
  summaries: ForecastRowForecast[] | undefined,
  nextSummary: ForecastRowForecast
): ForecastRowForecast[] {
  const existing = summaries ?? [];
  const index = existing.findIndex((summary) => summary.din === nextSummary.din);

  if (index === -1) {
    return [...existing, nextSummary];
  }

  return existing.map((summary, currentIndex) => (currentIndex === index ? nextSummary : summary));
}

export function removeForecastSummary(summaries: ForecastRowForecast[] | undefined, din: string): ForecastRowForecast[] {
  return (summaries ?? []).filter((summary) => summary.din !== din);
}

export function mergeDrugRows(
  forecasts: ForecastRowForecast[],
  stockMap: Map<string, StockEntry>,
  metadataByDin: Map<string, DrugMetadata | null> = new Map(),
  locationDrugs: { din: string; drugName: string | null; strength: string | null }[] = []
): DrugRow[] {
  const dins = new Set<string>();
  forecasts.forEach((forecast) => dins.add(forecast.din));
  stockMap.forEach((_stock, din) => dins.add(din));
  locationDrugs.forEach((drug) => dins.add(drug.din));

  return Array.from(dins).map((din) => {
    const forecast = forecasts.find((candidate) => candidate.din === din) ?? null;
    const stock = stockMap.get(din);
    const metadata = metadataByDin.get(din) ?? null;
    const locationDrug = locationDrugs.find((drug) => drug.din === din);
    const drugName =
      forecast?.drug_name?.trim() || locationDrug?.drugName?.trim() || din;
    const strength = forecast?.strength ?? locationDrug?.strength ?? null;

    return {
      din,
      drugName,
      strength,
      therapeuticClass: metadata?.therapeuticClass ?? null,
      drugStatus: metadata?.status ?? null,
      currentStock: stock ? stock.quantity : null,
      stockUpdatedAt: stock?.updatedAt ?? null,
      forecast
    };
  });
}

export function isStockEntered(row: Pick<DrugRow, "currentStock">) {
  return row.currentStock !== null && row.currentStock !== undefined;
}

export function rowStatusRank(row: DrugRow): number {
  if (!isStockEntered(row)) {
    return 5;
  }

  const status = normalizedReorderStatus(row.forecast?.reorder_status);
  if (status === "RED") return 1;
  if (status === "AMBER") return 2;
  if (status === "GREEN") return 3;
  return 4;
}

export function normalizedReorderStatus(status: string | null | undefined): ReorderStatus | null {
  const normalized = status?.toUpperCase();
  return normalized === "RED" || normalized === "AMBER" || normalized === "GREEN" ? normalized : null;
}

export function isDiscontinuedStatus(status: string | null | undefined) {
  return status === "CANCELLED" || status === "DORMANT";
}

export function filterAndSortRows(
  rows: DrugRow[],
  searchQuery: string,
  filters: FilterState,
  sortKey: SortKey
): DrugRow[] {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return rows
    .filter((row) => {
      if (
        normalizedSearch &&
        !row.din.toLowerCase().includes(normalizedSearch) &&
        !row.drugName.toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }

      const status = normalizedReorderStatus(row.forecast?.reorder_status);
      if (filters.status === "red" && status !== "RED") return false;
      if (filters.status === "amber" && status !== "AMBER") return false;
      if (filters.status === "green" && status !== "GREEN") return false;
      if (filters.status === "notGenerated" && (!isStockEntered(row) || row.forecast)) return false;
      if (filters.status === "noStock" && isStockEntered(row)) return false;

      const confidence = row.forecast?.confidence?.toLowerCase();
      if (filters.confidence !== "all" && confidence !== filters.confidence) return false;

      if (
        filters.therapeuticClass !== "all" &&
        (row.therapeuticClass ?? "Unknown") !== filters.therapeuticClass
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => compareRows(a, b, sortKey));
}

function compareRows(a: DrugRow, b: DrugRow, sortKey: SortKey) {
  if (sortKey === "drugName") {
    return a.drugName.localeCompare(b.drugName);
  }

  if (sortKey === "daysOfSupply") {
    return nullableNumber(a.forecast?.days_of_supply) - nullableNumber(b.forecast?.days_of_supply);
  }

  if (sortKey === "predictedQuantity") {
    return nullableNumber(b.forecast?.predicted_quantity) - nullableNumber(a.forecast?.predicted_quantity);
  }

  const statusDifference = rowStatusRank(a) - rowStatusRank(b);
  return statusDifference || a.drugName.localeCompare(b.drugName);
}

function nullableNumber(value: number | null | undefined) {
  return value === null || value === undefined ? Number.POSITIVE_INFINITY : value;
}

export function dashboardStats(rows: DrugRow[]) {
  return rows.reduce(
    (stats, row) => {
      const status = normalizedReorderStatus(row.forecast?.reorder_status);
      stats.tracked += 1;
      if (!isStockEntered(row)) stats.missingStock += 1;
      if (status === "RED") stats.red += 1;
      if (status === "AMBER") stats.amber += 1;
      if (status === "GREEN") stats.green += 1;
      return stats;
    },
    { tracked: 0, red: 0, amber: 0, green: 0, missingStock: 0 }
  );
}

export function resolveGenerationTarget(
  rows: DrugRow[],
  selectedDins: Set<string>,
  mode: BulkMode,
  savingDins: Set<string>
) {
  const targetRows = mode === "all" ? rows : rows.filter((row) => selectedDins.has(row.din));
  const stockedDins = targetRows.filter(isStockEntered).map((row) => row.din);
  const missingStockDins = targetRows.filter((row) => !isStockEntered(row)).map((row) => row.din);
  const savingTargetDins = targetRows.filter((row) => savingDins.has(row.din)).map((row) => row.din);

  return {
    targetDins: targetRows.map((row) => row.din),
    stockedDins,
    missingStockDins,
    savingTargetDins
  };
}

export function isDoneEvent(event: ForecastBatchEvent): event is Extract<ForecastBatchEvent, { done: true }> {
  return "done" in event && event.done === true;
}

export function isBatchErrorEvent(event: ForecastBatchEvent): event is Extract<ForecastBatchEvent, { error: string }> {
  return "error" in event;
}

export function isBatchResultEvent(event: ForecastBatchEvent): event is Extract<ForecastBatchEvent, { forecast: ForecastResult }> {
  return "forecast" in event;
}
