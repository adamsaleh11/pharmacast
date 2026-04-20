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

export function forecastResultToSummary(result: ForecastResult): ForecastSummaryDto {
  return {
    din: result.din,
    drug_name: null,
    strength: null,
    predicted_quantity: result.predicted_quantity,
    confidence: result.confidence,
    days_of_supply: result.days_of_supply,
    reorder_status: result.reorder_status,
    generated_at: result.generated_at,
    current_stock: null,
    stock_entered: false,
    threshold: null
  };
}

export function mergeForecastSummary(
  summaries: ForecastSummaryDto[] | undefined,
  nextSummary: ForecastSummaryDto
): ForecastSummaryDto[] {
  const existing = summaries ?? [];
  const index = existing.findIndex((summary) => summary.din === nextSummary.din);

  if (index === -1) {
    return [...existing, nextSummary];
  }

  return existing.map((summary, currentIndex) =>
    currentIndex === index
      ? {
          ...summary,
          ...nextSummary,
          drug_name: nextSummary.drug_name ?? summary.drug_name,
          strength: nextSummary.strength ?? summary.strength,
          threshold: nextSummary.threshold ?? summary.threshold
        }
      : summary
  );
}

export function mergeDrugRows(
  forecasts: ForecastSummaryDto[],
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
