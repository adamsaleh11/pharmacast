export type DrugDetailConfidence = "HIGH" | "MEDIUM" | "LOW";

export type DrugDetailReorderStatus = "GREEN" | "AMBER" | "RED";

export type SafetyMultiplier = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";

export type DrugDetailResponse = {
  drug: DrugDetailDrugDto;
  current_stock: number | null;
  stock_last_updated: string | null;
  latest_forecast: DrugDetailForecastDto | null;
  threshold: DrugDetailThresholdDto | null;
  dispensing_history: DrugDetailDispensingHistoryDto[];
  stock_adjustments: DrugDetailStockAdjustmentDto[];
};

export type DrugDetailDrugDto = {
  din: string;
  name: string;
  strength: string;
  form: string;
  therapeutic_class: string;
  manufacturer: string;
  status: string;
};

export type DrugDetailForecastDto = {
  din: string;
  generated_at: string;
  forecast_horizon_days: number;
  predicted_quantity: number;
  model_path?: string | null;
  confidence: DrugDetailConfidence;
  days_of_supply: number;
  reorder_status: DrugDetailReorderStatus;
  prophet_lower: number;
  prophet_upper: number;
  avg_daily_demand: number;
  reorder_point: number;
  data_points_used: number;
};

export type DrugDetailThresholdDto = {
  lead_time_days: number;
  red_threshold_days: number;
  amber_threshold_days: number;
  safety_multiplier: SafetyMultiplier;
  notifications_enabled: boolean;
};

export type DrugDetailDispensingHistoryDto = {
  week: string;
  quantity: number;
};

export type DrugDetailStockAdjustmentDto = {
  adjusted_at: string;
  adjustment_quantity: number;
  note: string;
};

export type DrugThresholdUpsertRequest = {
  lead_time_days?: number;
  red_threshold_days?: number;
  amber_threshold_days?: number;
  safety_multiplier?: SafetyMultiplier;
  notifications_enabled?: boolean;
};

export type StockAdjustmentCreateRequest = {
  adjustment_quantity: number;
  note: string;
};
