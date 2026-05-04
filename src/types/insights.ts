export type InsightsPeriod = 30 | 60 | 90;

export type SavingsInsightsResponse = {
  period_days: number;
  total_savings: number | null;
  overstock_avoided: {
    value: number | null;
    requires_cost_data: boolean;
  };
  waste_eliminated: {
    value: number | null;
    requires_multiple_uploads: boolean;
  };
  stockouts_prevented: {
    count: number;
    estimated_value: number;
  };
  insufficient_data: boolean;
  data_quality_message: string | null;
};

export type AccuracyInsightsResponse = {
  overall_accuracy_pct: number | null;
  by_drug: DrugAccuracy[];
};

export type DrugAccuracy = {
  din: string;
  drug_name: string;
  mape: number;
  forecast_qty: number;
  actual_qty: number;
};

export type TrendsInsightsResponse = {
  top_growing: DemandChange[];
  top_declining: DemandChange[];
  seasonal_peaks: SeasonalPeak[];
  total_dispensing_trend: WeeklyTotal[];
};

export type DemandChange = {
  din: string;
  drug_name: string;
  growth_pct: number | null;
  decline_pct: number | null;
  weekly_trend: number[];
};

export type SeasonalPeak = {
  din: string;
  drug_name: string;
  peak_month: number;
  avg_peak_demand: number;
};

export type WeeklyTotal = {
  week: string;
  total_quantity: number;
};

export type HealthScoreResponse = {
  score: number;
  breakdown: {
    stock_health: number;
    accuracy: number;
    stockout_reduction: number;
  };
};
