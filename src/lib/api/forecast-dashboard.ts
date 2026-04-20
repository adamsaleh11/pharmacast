import { ApiError, createApiClient } from "@/lib/api/client";
import { getPublicEnv } from "@/lib/env";
import type {
  CurrentStockResponse,
  DrugListResponse,
  ForecastBatchEvent,
  ForecastResult,
  ForecastSummaryDto,
  ForecastThresholdDto
} from "@/types/forecast-dashboard";

const apiClient = createApiClient();

export function listForecasts(
  locationId: string,
  horizonDays: number,
  accessToken: string
): Promise<ForecastSummaryDto[]> {
  return apiClient.get<ForecastSummaryDto[]>(
    `/locations/${locationId}/forecasts?horizonDays=${horizonDays}`,
    { accessToken }
  );
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
  return apiClient.post<ForecastResult>(
    `/locations/${locationId}/forecasts/generate`,
    { din, horizon_days: horizonDays },
    { accessToken }
  );
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
