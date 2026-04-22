"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { explainForecast, explanationQueryKey, EXPLANATION_STALE_TIME_MS } from "@/lib/api/forecast-dashboard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";
import type { ForecastExplanationResponse } from "@/types/forecast-explanation";

type UseForecastExplanationOptions = {
  locationId: string | null | undefined;
  din: string | null | undefined;
  accessTokenLabel: string;
};

async function getDashboardAccessToken(label: string) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const accessToken = await getBackendAccessToken(supabase, label);

  if (!accessToken) {
    throw new Error("You must be signed in to view forecast explanations.");
  }

  return accessToken;
}

export function useForecastExplanation({ locationId, din, accessTokenLabel }: UseForecastExplanationOptions) {
  const queryClient = useQueryClient();
  const queryKey = explanationQueryKey(locationId, din);
  const [requesting, setRequesting] = useState(false);

  const query = useQuery({
    queryKey,
    enabled: false,
    staleTime: EXPLANATION_STALE_TIME_MS,
    retry: false,
    queryFn: async () => {
      const accessToken = await getDashboardAccessToken(accessTokenLabel);
      return explainForecast(locationId ?? "", din ?? "", accessToken);
    }
  });

  const explain = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!locationId || !din) {
        return null;
      }

      const cached = queryClient.getQueryData<ForecastExplanationResponse>(queryKey);
      const queryState = queryClient.getQueryState(queryKey);
      const isFresh = Boolean(cached) && Boolean(queryState?.dataUpdatedAt) && Date.now() - queryState.dataUpdatedAt < EXPLANATION_STALE_TIME_MS;

      if (!force && isFresh && cached) {
        return cached;
      }

      if (force) {
        await queryClient.cancelQueries({ queryKey });
        queryClient.removeQueries({ queryKey });
      }

      setRequesting(true);
      try {
        return await queryClient.fetchQuery({
          queryKey,
          staleTime: EXPLANATION_STALE_TIME_MS,
          queryFn: async () => {
            const accessToken = await getDashboardAccessToken(accessTokenLabel);
            return explainForecast(locationId, din, accessToken);
          }
        });
      } finally {
        setRequesting(false);
      }
    },
    [accessTokenLabel, din, locationId, queryClient, queryKey]
  );

  return {
    explanationText: query.data?.explanation ?? null,
    generatedAt: query.data?.generated_at ?? null,
    isLoading: requesting || query.isFetching,
    isError: query.isError,
    explain
  };
}
