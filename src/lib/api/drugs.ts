import { ApiError, createApiClient } from "@/lib/api/client";
import type { DrugResponse } from "@/types/drug";

const apiClient = createApiClient();

export function normalizeDin(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed || !/^\d{1,8}$/.test(trimmed)) {
    return null;
  }

  return trimmed.padStart(8, "0");
}

export function getDrug(din: string, accessToken: string): Promise<DrugResponse> {
  return apiClient.get<DrugResponse>(`/drugs/${din}`, { accessToken });
}

export function isNotFoundApiError(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}
