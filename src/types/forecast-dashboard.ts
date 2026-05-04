export type ForecastConfidence = "HIGH" | "MEDIUM" | "LOW";

export type ReorderStatus = "RED" | "AMBER" | "GREEN";

export type ForecastThresholdDto = {
  lead_time_days: number;
  safety_multiplier: number;
  red_threshold_days?: number;
  amber_threshold_days?: number;
};

export type ForecastSummaryDto = {
  din: string;
  drug_name: string | null;
  strength: string | null;
  predicted_quantity: number;
  model_path?: string | null;
  confidence: ForecastConfidence | string;
  days_of_supply: number;
  reorder_status: ReorderStatus | string;
  generated_at: string;
  current_stock: number | null;
  stock_entered: boolean;
  threshold?: ForecastThresholdDto | null;
};

export type ForecastListResponse = {
  forecasts: ForecastSummaryDto[];
  warnings: string[];
};

export type CurrentStockResponse = {
  din: string;
  quantity: number;
  updated_at: string;
};

export type ForecastResult = {
  din: string;
  location_id: string;
  horizon_days: number;
  predicted_quantity: number;
  model_path?: string | null;
  prophet_lower: number;
  prophet_upper: number;
  confidence: ForecastConfidence | string;
  days_of_supply: number;
  avg_daily_demand: number;
  reorder_status: ReorderStatus | string;
  reorder_point: number;
  generated_at: string;
  data_points_used: number;
};

export type ForecastBatchResultEvent = {
  din: string;
  forecast: ForecastResult;
};

export type ForecastBatchErrorEvent = {
  din: string;
  error: string;
};

export type ForecastBatchDoneEvent = {
  done: true;
  total: number;
  succeeded: number;
  failed: number;
  skipped_no_stock: number;
  skipped_dins: string[];
};

export type ForecastBatchEvent = ForecastBatchResultEvent | ForecastBatchErrorEvent | ForecastBatchDoneEvent;

export type StockEntry = {
  quantity: number;
  updatedAt: string | null;
};

export type DrugMetadata = {
  therapeuticClass: string | null;
  status: string | null;
};

export type DrugRow = {
  din: string;
  drugName: string;
  strength: string | null;
  therapeuticClass: string | null;
  drugStatus: string | null;
  currentStock: number | null;
  stockUpdatedAt: string | null;
  forecast: ForecastSummaryDto & Partial<Pick<ForecastResult, "prophet_lower" | "prophet_upper" | "avg_daily_demand" | "reorder_point" | "data_points_used">> | null;
};

export type BulkMode = "all" | "selected";

export type SortKey = "status" | "drugName" | "daysOfSupply" | "predictedQuantity";

export type FilterState = {
  status: "all" | "red" | "amber" | "green" | "notGenerated" | "noStock";
  confidence: "all" | "high" | "medium" | "low";
  therapeuticClass: string;
};

export type DrugListItem = {
  din: string;
  drugName: string | null;
  strength: string | null;
  therapeuticClass: string | null;
  manufacturer: string | null;
  status: string | null;
};

export type DrugListResponse = {
  drugs: DrugListItem[];
};
