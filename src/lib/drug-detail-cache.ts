import type { QueryClient } from "@tanstack/react-query";
import type { ForecastResult } from "@/types/forecast-dashboard";
import type { DrugDetailResponse } from "@/types/drug-detail";

type DrugDetailForecast = NonNullable<DrugDetailResponse["latest_forecast"]>;
type DrugDetailThreshold = NonNullable<DrugDetailResponse["threshold"]>;
type DrugDetailAdjustment = DrugDetailResponse["stock_adjustments"][number];

export function drugDetailQueryKey(locationId: string | null | undefined, din: string | null | undefined) {
  return ["drug-detail", locationId, din] as const;
}

export function setDrugDetailCurrentStock(
  queryClient: QueryClient,
  locationId: string,
  din: string,
  quantity: number | null,
  updatedAt: string | null
) {
  queryClient.setQueryData<DrugDetailResponse>(drugDetailQueryKey(locationId, din), (current) =>
    current ? { ...current, current_stock: quantity, stock_last_updated: updatedAt } : current
  );
}

export function setDrugDetailForecast(
  queryClient: QueryClient,
  locationId: string,
  forecast: ForecastResult
) {
  queryClient.setQueryData<DrugDetailResponse>(drugDetailQueryKey(locationId, forecast.din), (current) =>
    current
      ? {
          ...current,
          latest_forecast: {
            din: forecast.din,
            generated_at: forecast.generated_at,
            forecast_horizon_days: forecast.horizon_days,
            predicted_quantity: forecast.predicted_quantity,
            model_path: forecast.model_path ?? null,
            confidence: forecast.confidence as DrugDetailForecast["confidence"],
            days_of_supply: forecast.days_of_supply,
            reorder_status: forecast.reorder_status as DrugDetailForecast["reorder_status"],
            prophet_lower: forecast.prophet_lower,
            prophet_upper: forecast.prophet_upper,
            avg_daily_demand: forecast.avg_daily_demand,
            reorder_point: forecast.reorder_point,
            data_points_used: forecast.data_points_used
          }
        }
      : current
  );
}

export function setDrugDetailThreshold(
  queryClient: QueryClient,
  locationId: string,
  din: string,
  threshold: DrugDetailThreshold | null
) {
  queryClient.setQueryData<DrugDetailResponse>(drugDetailQueryKey(locationId, din), (current) =>
    current ? { ...current, threshold } : current
  );
}

export function prependDrugDetailAdjustment(
  queryClient: QueryClient,
  locationId: string,
  din: string,
  adjustment: DrugDetailAdjustment
) {
  queryClient.setQueryData<DrugDetailResponse>(drugDetailQueryKey(locationId, din), (current) =>
    current
      ? {
          ...current,
          stock_adjustments: [adjustment, ...current.stock_adjustments].slice(0, 10)
        }
      : current
  );
}
