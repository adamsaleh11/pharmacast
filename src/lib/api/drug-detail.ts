import { ApiError, createApiClient } from "@/lib/api/client";
import type {
  DrugDetailResponse,
  DrugThresholdUpsertRequest,
  StockAdjustmentCreateRequest
} from "@/types/drug-detail";

const apiClient = createApiClient();

export { ApiError };

export function drugDetailQueryKey(locationId: string | null | undefined, din: string | null | undefined) {
  return ["drug-detail", locationId, din] as const;
}

export function getDrugDetail(locationId: string, din: string, accessToken: string): Promise<DrugDetailResponse> {
  return apiClient.get<DrugDetailResponse>(`/locations/${locationId}/drugs/${din}/detail`, { accessToken });
}

export function upsertDrugThreshold(
  locationId: string,
  din: string,
  body: DrugThresholdUpsertRequest,
  accessToken: string
): Promise<NonNullable<DrugDetailResponse["threshold"]>> {
  return apiClient.put<NonNullable<DrugDetailResponse["threshold"]>>(`/locations/${locationId}/drugs/${din}/threshold`, body, {
    accessToken
  });
}

export function resetDrugThreshold(locationId: string, din: string, accessToken: string): Promise<void> {
  return apiClient.delete<void>(`/locations/${locationId}/drugs/${din}/threshold`, { accessToken });
}

export function createStockAdjustment(
  locationId: string,
  din: string,
  body: StockAdjustmentCreateRequest,
  accessToken: string
): Promise<{ adjustment: DrugDetailResponse["stock_adjustments"][number] }> {
  return apiClient.post<{ adjustment: DrugDetailResponse["stock_adjustments"][number] }>(
    `/locations/${locationId}/drugs/${din}/adjust`,
    body,
    { accessToken }
  );
}
