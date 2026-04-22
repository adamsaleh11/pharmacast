import { ApiError, createApiClient } from "@/lib/api/client";
import { getPublicEnv } from "@/lib/env";
import { normalizeForecastResult, normalizeForecastSummary } from "@/lib/forecast-dashboard/model";
import type { ForecastExplanationResponse } from "@/types/forecast-explanation";
import type {
  CurrentStockResponse,
  DrugListResponse,
  ForecastBatchEvent,
  ForecastListResponse,
  ForecastResult,
  ForecastThresholdDto
} from "@/types/forecast-dashboard";

const apiClient = createApiClient();
export const EXPLANATION_STALE_TIME_MS = 60 * 60 * 1000;

export function explanationQueryKey(locationId: string | null | undefined, din: string | null | undefined) {
  return ["explanation", locationId, din] as const;
}

export function listForecasts(
  locationId: string,
  horizonDays: number,
  accessToken: string
): Promise<ForecastListResponse> {
  return apiClient.get<unknown>(
    `/locations/${locationId}/forecasts?horizonDays=${horizonDays}`,
    { accessToken }
  ).then((response) => {
    if (!Array.isArray(response)) {
      throw new Error("Forecast response must be an array.");
    }

    const warnings: string[] = [];
    const forecasts = response.flatMap((item, index) => {
      try {
        return [normalizeForecastSummary(item, `Forecast row ${index + 1}`)];
      } catch (error) {
        const message = error instanceof Error ? error.message : `Forecast row ${index + 1} is invalid.`;
        warnings.push(message);
        return [];
      }
    });

    return { forecasts, warnings };
  });
}

export function listLocationDrugs(locationId: string, accessToken: string): Promise<DrugListResponse> {
  return apiClient.get<DrugListResponse>(`/locations/${locationId}/drugs`, { accessToken });
}

export function listCurrentStock(locationId: string, accessToken: string): Promise<CurrentStockResponse[]> {
  return apiClient.get<CurrentStockResponse[]>(`/locations/${locationId}/stock`, { accessToken });
}

export function upsertCurrentStock(
  locationId: string,
  din: string,
  quantity: number,
  accessToken: string
): Promise<CurrentStockResponse> {
  return apiClient.put<CurrentStockResponse>(`/locations/${locationId}/stock/${din}`, { quantity }, { accessToken });
}

export function generateForecast(
  locationId: string,
  din: string,
  horizonDays: number,
  accessToken: string
): Promise<ForecastResult> {
  return apiClient.post<unknown>(
    `/locations/${locationId}/forecasts/generate`,
    { din, horizon_days: horizonDays },
    { accessToken }
  ).then((response) => normalizeForecastResult(response, "Forecast generation response"));
}

export function explainForecast(
  locationId: string,
  din: string,
  accessToken: string
): Promise<ForecastExplanationResponse> {
  return apiClient.post<ForecastExplanationResponse>(`/locations/${locationId}/forecasts/${din}/explain`, undefined, {
    accessToken
  });
}

export type StreamBatchForecastOptions = {
  locationId: string;
  dins: string[];
  horizonDays: number;
  thresholds: Record<string, ForecastThresholdDto>;
  accessToken: string;
  signal?: AbortSignal;
  onEvent: (event: ForecastBatchEvent) => void;
};

export async function streamBatchForecast({
  locationId,
  dins,
  horizonDays,
  thresholds,
  accessToken,
  signal,
  onEvent
}: StreamBatchForecastOptions): Promise<void> {
  const env = getPublicEnv();

  if (!env.hasApiConfig) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const response = await fetch(`${env.apiUrl}/locations/${locationId}/forecasts/generate-all`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      location_id: locationId,
      dins,
      horizon_days: horizonDays,
      thresholds
    })
  });

  if (!response.ok) {
    let code: string | undefined;
    try {
      const errorBody = (await response.json()) as { error?: string };
      code = errorBody.error;
    } catch {
      code = undefined;
    }
    throw new ApiError(`API request failed with status ${response.status}.`, response.status, code);
  }

  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n+/);
    buffer = events.pop() ?? "";

    events.forEach((eventText) => {
      parseSseEvent(eventText).forEach(onEvent);
    });
  }

  buffer += decoder.decode();
  parseSseEvent(buffer).forEach(onEvent);
}

export function parseSseEvent(eventText: string): ForecastBatchEvent[] {
  return eventText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean)
    .flatMap((payload) => {
      try {
        return [JSON.parse(payload) as ForecastBatchEvent];
      } catch {
        return [];
      }
    });
}
