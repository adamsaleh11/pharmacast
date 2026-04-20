"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { getDrug, isNotFoundApiError, normalizeDin } from "@/lib/api/drugs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";
import type { DrugResponse } from "@/types/drug";

const DRUG_METADATA_STALE_TIME_MS = 60 * 60 * 1000;

async function fetchDrugMetadata(normalizedDin: string): Promise<DrugResponse | null> {
  try {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return null;
    }

    const accessToken = await getBackendAccessToken(supabase, "drug-metadata");

    if (!accessToken) {
      return null;
    }

    return await getDrug(normalizedDin, accessToken);
  } catch (error) {
    if (isNotFoundApiError(error)) {
      return null;
    }

    return null;
  }
}

export function drugMetadataQueryKey(din: string | null | undefined) {
  return ["drug", normalizeDin(din)] as const;
}

export function useDrugMetadata(din: string | null | undefined) {
  const normalizedDin = normalizeDin(din);

  return useQuery({
    queryKey: drugMetadataQueryKey(din),
    queryFn: () => fetchDrugMetadata(normalizedDin ?? ""),
    enabled: Boolean(normalizedDin),
    staleTime: DRUG_METADATA_STALE_TIME_MS,
    retry: false
  });
}

export function useDrugMetadataMap(dins: readonly string[]) {
  const normalizedDins = useMemo(() => {
    return Array.from(new Set(dins.map((din) => normalizeDin(din)).filter(Boolean))) as string[];
  }, [dins]);

  const results = useQueries({
    queries: normalizedDins.map((normalizedDin) => ({
      queryKey: drugMetadataQueryKey(normalizedDin),
      queryFn: () => fetchDrugMetadata(normalizedDin),
      staleTime: DRUG_METADATA_STALE_TIME_MS,
      retry: false
    }))
  });

  return useMemo(() => {
    const metadataByDin = new Map<string, DrugResponse | null>();

    normalizedDins.forEach((normalizedDin, index) => {
      metadataByDin.set(normalizedDin, results[index]?.data ?? null);
    });

    return metadataByDin;
  }, [normalizedDins, results]);
}

export { DRUG_METADATA_STALE_TIME_MS };
