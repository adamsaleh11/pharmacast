import { createApiClient } from "@/lib/api/client";
import type {
  AccuracyInsightsResponse,
  HealthScoreResponse,
  InsightsPeriod,
  SavingsInsightsResponse,
  TrendsInsightsResponse
} from "@/types/insights";

const apiClient = createApiClient();

export const INSIGHTS_STALE_TIME_MS = 5 * 60 * 1000;

export const insightsQueryKeys = {
  root: ["insights"] as const,
  savings: (locationId: string, period: InsightsPeriod) => ["insights", "savings", locationId, period] as const,
  accuracy: (locationId: string, period: InsightsPeriod) => ["insights", "accuracy", locationId, period] as const,
  trends: (locationId: string, period: InsightsPeriod) => ["insights", "trends", locationId, period] as const,
  healthScore: (locationId: string) => ["insights", "healthScore", locationId] as const
};

export function getSavingsInsights(
  locationId: string,
  period: InsightsPeriod,
  accessToken: string
): Promise<SavingsInsightsResponse> {
  return apiClient.get<SavingsInsightsResponse>(`/locations/${locationId}/insights/savings?period=${period}`, {
    accessToken
  });
}

export function getAccuracyInsights(
  locationId: string,
  period: InsightsPeriod,
  accessToken: string
): Promise<AccuracyInsightsResponse> {
  return apiClient.get<AccuracyInsightsResponse>(`/locations/${locationId}/insights/accuracy?period=${period}`, {
    accessToken
  });
}

export function getTrendsInsights(
  locationId: string,
  period: InsightsPeriod,
  accessToken: string
): Promise<TrendsInsightsResponse> {
  return apiClient.get<TrendsInsightsResponse>(`/locations/${locationId}/insights/trends?period=${period}`, {
    accessToken
  });
}

export function getHealthScoreInsights(locationId: string, accessToken: string): Promise<HealthScoreResponse> {
  return apiClient.get<HealthScoreResponse>(`/locations/${locationId}/insights/health-score`, { accessToken });
}
