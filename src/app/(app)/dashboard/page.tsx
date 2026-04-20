"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  CalendarClock,
  Check,
  ChevronRight,
  Download,
  Edit3,
  Info,
  Loader2,
  Package,
  PauseCircle,
  Play,
  Search,
  Sparkles,
  Upload,
  X
} from "lucide-react";
import { AppPageHeader } from "@/components/product/app-page-header";
import { ConfidenceBadge } from "@/components/product/confidence-badge";
import { EmptyState } from "@/components/product/empty-state";
import { LoadingSpinner } from "@/components/product/loading-spinner";
import { StatCard } from "@/components/product/stat-card";
import { StatusBadge } from "@/components/product/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listUploads } from "@/lib/api/upload";
import {
  generateForecast,
  listCurrentStock,
  listForecasts,
  listLocationDrugs,
  streamBatchForecast,
  upsertCurrentStock
} from "@/lib/api/forecast-dashboard";
import { normalizeDin } from "@/lib/api/drugs";
import { ApiError } from "@/lib/api/client";
import {
  dashboardStats,
  filterAndSortRows,
  forecastResultToSummary,
  isBatchErrorEvent,
  isBatchResultEvent,
  isDiscontinuedStatus,
  isDoneEvent,
  isStockEntered,
  mergeForecastSummary,
  mergeDrugRows,
  normalizedReorderStatus,
  parseStockInput,
  resolveGenerationTarget,
  stockResponsesToMap,
  validateStockInput
} from "@/lib/forecast-dashboard/model";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";
import { cn } from "@/lib/utils";
import { useDrugMetadataMap } from "@/hooks/use-drug-metadata";
import { useAppContext } from "@/providers/app-context";
import type { UploadResponse } from "@/types/upload";
import type {
  BulkMode,
  DrugMetadata,
  DrugRow,
  FilterState,
  ForecastResult,
  ForecastSummaryDto,
  ForecastThresholdDto,
  SortKey,
  StockEntry
} from "@/types/forecast-dashboard";

const HORIZONS = [7, 14, 30] as const;
const FORECAST_VISIBLE_INCREMENT = 50;
const DEFAULT_FILTERS: FilterState = {
  status: "all",
  confidence: "all",
  therapeuticClass: "all"
};

type ToastState = {
  tone: "success" | "warning" | "danger" | "muted";
  message: string;
} | null;

type EditingState = {
  din: string;
  value: string;
  previousQuantity: number | null;
};

type BulkProgress = {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  targetDins: string[];
};

async function getDashboardAccessToken(label: string) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const accessToken = await getBackendAccessToken(supabase, label);

  if (!accessToken) {
    throw new Error("You must be signed in to view the dashboard.");
  }

  return accessToken;
}

function forecastQueryKey(locationId: string | null | undefined, horizonDays: number) {
  return ["forecasts", locationId, horizonDays] as const;
}

function stockQueryKey(locationId: string | null | undefined) {
  return ["stock", locationId] as const;
}

function uploadsQueryKey(locationId: string | null | undefined) {
  return ["uploads", locationId] as const;
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { currentLocation } = useAppContext();
  const locationId = currentLocation?.id ?? null;
  const [horizonDays, setHorizonDays] = useState<(typeof HORIZONS)[number]>(14);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [stockMap, setStockMap] = useState<Map<string, StockEntry>>(new Map());
  const [editingStock, setEditingStock] = useState<EditingState | null>(null);
  const [stockWarnings, setStockWarnings] = useState<Map<string, string>>(new Map());
  const [stockSuccessDins, setStockSuccessDins] = useState<Set<string>>(new Set());
  const [savingDins, setSavingDins] = useState<Set<string>>(new Set());
  const [selectedDins, setSelectedDins] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<BulkMode>("all");
  const [visibleLimit, setVisibleLimit] = useState(FORECAST_VISIBLE_INCREMENT);
  const [toast, setToast] = useState<ToastState>(null);
  const [confirmTarget, setConfirmTarget] = useState<ReturnType<typeof resolveGenerationTarget> | null>(null);
  const [pulseStockHeader, setPulseStockHeader] = useState(false);
  const [pulseSelectionHeader, setPulseSelectionHeader] = useState(false);
  const [generatingDins, setGeneratingDins] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(new Map());
  const [forecastStockByDin, setForecastStockByDin] = useState<Map<string, number | null>>(new Map());
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [selectedDetailDin, setSelectedDetailDin] = useState<string | null>(null);
  const stockInputRefs = useRef(new Map<string, HTMLInputElement>());
  const tableParentRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 200);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), toast.tone === "danger" ? 5000 : 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const forecastsQuery = useQuery({
    queryKey: forecastQueryKey(locationId, horizonDays),
    enabled: Boolean(locationId),
    staleTime: 0,
    queryFn: async () => {
      const accessToken = await getDashboardAccessToken("dashboard-forecasts");
      return listForecasts(locationId ?? "", horizonDays, accessToken);
    }
  });

  const stockQuery = useQuery({
    queryKey: stockQueryKey(locationId),
    enabled: Boolean(locationId),
    staleTime: 30_000,
    queryFn: async () => {
      const accessToken = await getDashboardAccessToken("dashboard-stock");
      return listCurrentStock(locationId ?? "", accessToken);
    }
  });

  const uploadsQuery = useQuery({
    queryKey: uploadsQueryKey(locationId),
    enabled: Boolean(locationId),
    staleTime: 30_000,
    queryFn: async () => {
      const accessToken = await getDashboardAccessToken("dashboard-uploads");
      return listUploads(locationId ?? "", accessToken);
    }
  });

  const locationDrugsQuery = useQuery({
    queryKey: ["location-drugs", locationId] as const,
    enabled: Boolean(locationId),
    staleTime: 30_000,
    queryFn: async () => {
      const accessToken = await getDashboardAccessToken("dashboard-location-drugs");
      return listLocationDrugs(locationId ?? "", accessToken);
    }
  });

  useEffect(() => {
    if (stockQuery.data) {
      setStockMap(stockResponsesToMap(stockQuery.data));
    }
  }, [stockQuery.data]);

  const forecastRows = useMemo(() => forecastsQuery.data ?? [], [forecastsQuery.data]);
  const locationDrugs = useMemo(() => locationDrugsQuery.data?.drugs ?? [], [locationDrugsQuery.data]);

  const baseDins = useMemo(() => {
    const dins = new Set<string>();
    forecastRows.forEach((forecast) => dins.add(forecast.din));
    stockMap.forEach((_stock, din) => dins.add(din));
    locationDrugs.forEach((drug) => dins.add(drug.din));
    return Array.from(dins);
  }, [forecastRows, stockMap, locationDrugs]);
  const metadataByDinRaw = useDrugMetadataMap(baseDins);
  const metadataByDin = useMemo(() => {
    const nextMetadata = new Map<string, DrugMetadata | null>();
    metadataByDinRaw.forEach((metadata, din) => {
      nextMetadata.set(din, metadata ? { therapeuticClass: metadata.therapeuticClass, status: metadata.status } : null);
    });
    return nextMetadata;
  }, [metadataByDinRaw]);

  const rows = useMemo(
    () => mergeDrugRows(forecastRows, stockMap, metadataByDin, locationDrugs),
    [forecastRows, metadataByDin, stockMap, locationDrugs]
  );
  const stats = useMemo(() => dashboardStats(rows), [rows]);
  const therapeuticClasses = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.therapeuticClass).filter(Boolean) as string[])).sort();
  }, [rows]);
  const visibleRows = useMemo(
    () => filterAndSortRows(rows, debouncedSearchQuery, filters, sortKey),
    [debouncedSearchQuery, filters, rows, sortKey]
  );
  const tableRows = visibleRows.slice(0, visibleLimit);
  const selectedDetailRow = selectedDetailDin ? rows.find((row) => row.din === selectedDetailDin) ?? null : null;

  useEffect(() => {
    setVisibleLimit(FORECAST_VISIBLE_INCREMENT);
  }, [debouncedSearchQuery, filters, sortKey, horizonDays]);

  useEffect(() => {
    setForecastStockByDin((current) => {
      const next = new Map(current);
      let changed = false;
      rows.forEach((row) => {
        if (row.forecast && isStockEntered(row) && !next.has(row.din)) {
          next.set(row.din, row.currentStock);
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [rows]);

  useEffect(() => {
    setSelectedDins((current) => {
      const validDins = new Set(rows.map((row) => row.din));
      const next = new Set(Array.from(current).filter((din) => validDins.has(din)));
      return next.size === current.size ? current : next;
    });
  }, [rows]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const setTemporaryStockWarning = useCallback((din: string, message: string) => {
    setStockWarnings((current) => new Map(current).set(din, message));
    window.setTimeout(() => {
      setStockWarnings((current) => {
        const next = new Map(current);
        next.delete(din);
        return next;
      });
    }, 3500);
  }, []);

  const markStockSuccess = useCallback((din: string) => {
    setStockSuccessDins((current) => new Set(current).add(din));
    window.setTimeout(() => {
      setStockSuccessDins((current) => {
        const next = new Set(current);
        next.delete(din);
        return next;
      });
    }, 2000);
  }, []);

  const stockMutation = useMutation({
    mutationFn: async ({ din, quantity }: { din: string; quantity: number }) => {
      const accessToken = await getDashboardAccessToken("dashboard-stock-save");
      return upsertCurrentStock(locationId ?? "", din, quantity, accessToken);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: stockQueryKey(locationId) });
    }
  });

  const saveStock = useCallback(
    async (din: string, quantity: number, previousQuantity: number | null) => {
      if (!locationId) {
        setTemporaryStockWarning(din, "Choose a location first");
        return false;
      }

      setSavingDins((current) => new Set(current).add(din));
      setStockMap((current) => {
        const next = new Map(current);
        next.set(din, { quantity, updatedAt: new Date().toISOString() });
        return next;
      });

      try {
        const saved = await stockMutation.mutateAsync({ din, quantity });
        setStockMap((current) => {
          const next = new Map(current);
          next.set(din, { quantity: saved.quantity, updatedAt: saved.updated_at });
          return next;
        });
        markStockSuccess(din);
        setRowErrors((current) => {
          const next = new Map(current);
          next.delete(din);
          return next;
        });
        return true;
      } catch (error) {
        setStockMap((current) => {
          const next = new Map(current);
          if (previousQuantity === null) {
            next.delete(din);
          } else {
            next.set(din, { quantity: previousQuantity, updatedAt: current.get(din)?.updatedAt ?? null });
          }
          return next;
        });
        setTemporaryStockWarning(din, stockErrorMessage(error));
        return false;
      } finally {
        setSavingDins((current) => {
          const next = new Set(current);
          next.delete(din);
          return next;
        });
      }
    },
    [locationId, markStockSuccess, setTemporaryStockWarning, stockMutation]
  );

  const startEditingStock = useCallback(
    (din: string) => {
      const row = rows.find((candidate) => candidate.din === din);
      if (!row || isStockLocked(din, generatingDins, bulkProgress)) {
        return;
      }

      setEditingStock({
        din,
        value: isStockEntered(row) ? String(row.currentStock) : "",
        previousQuantity: isStockEntered(row) ? row.currentStock : null
      });
      window.setTimeout(() => {
        const input = stockInputRefs.current.get(din);
        input?.focus();
        input?.select();
      }, 0);
    },
    [bulkProgress, generatingDins, rows]
  );

  const commitStockEdit = useCallback(
    async (moveToNext: boolean) => {
      if (!editingStock) {
        return;
      }

      const validationMessage = validateStockInput(editingStock.value);
      if (validationMessage) {
        setTemporaryStockWarning(editingStock.din, validationMessage);
        return;
      }

      const quantity = parseStockInput(editingStock.value);
      const currentDin = editingStock.din;
      const nextDin = moveToNext ? nextVisibleDin(currentDin, visibleRows) : null;

      if (quantity === null) {
        setEditingStock(null);
        if (nextDin) {
          startEditingStock(nextDin);
        }
        return;
      }

      setEditingStock(null);
      const saved = await saveStock(currentDin, quantity, editingStock.previousQuantity);

      if (moveToNext && saved && nextDin) {
        startEditingStock(nextDin);
      }
    },
    [editingStock, saveStock, setTemporaryStockWarning, startEditingStock, visibleRows]
  );

  const handleGenerateRow = useCallback(
    async (row: DrugRow) => {
      if (!locationId || !isStockEntered(row) || savingDins.has(row.din)) {
        setRowErrors((current) => new Map(current).set(row.din, "Enter current stock first"));
        return;
      }

      setGeneratingDins((current) => new Set(current).add(row.din));
      setRowErrors((current) => {
        const next = new Map(current);
        next.delete(row.din);
        return next;
      });

      try {
        const accessToken = await getDashboardAccessToken("dashboard-generate-row");
        const result = await generateForecast(locationId, row.din, horizonDays, accessToken);
        mergeForecastResult(queryClient, locationId, horizonDays, result, row);
        setForecastStockByDin((current) => new Map(current).set(row.din, row.currentStock));
        setToast({ tone: "success", message: `Forecast generated for ${row.din}.` });
      } catch (error) {
        setRowErrors((current) => new Map(current).set(row.din, forecastErrorMessage(error)));
      } finally {
        setGeneratingDins((current) => {
          const next = new Set(current);
          next.delete(row.din);
          return next;
        });
      }
    },
    [horizonDays, locationId, queryClient, savingDins]
  );

  const runBulkGeneration = useCallback(
    async (targetDins: string[]) => {
      if (!locationId || targetDins.length === 0) {
        return;
      }

      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setConfirmTarget(null);
      setGeneratingDins(new Set(targetDins));
      setBulkProgress({ total: targetDins.length, completed: 0, succeeded: 0, failed: 0, skipped: 0, targetDins });
      setRowErrors((current) => {
        const next = new Map(current);
        targetDins.forEach((din) => next.delete(din));
        return next;
      });

      try {
        const accessToken = await getDashboardAccessToken("dashboard-generate-bulk");
        const thresholds = rows.reduce<Record<string, ForecastThresholdDto>>((nextThresholds, row) => {
          if (targetDins.includes(row.din) && row.forecast?.threshold) {
            nextThresholds[row.din] = row.forecast.threshold;
          }
          return nextThresholds;
        }, {});

        await streamBatchForecast({
          locationId,
          dins: targetDins,
          horizonDays,
          thresholds,
          accessToken,
          signal: abortController.signal,
          onEvent: (event) => {
            if (isBatchResultEvent(event)) {
              const row = rows.find((candidate) => candidate.din === event.din);
              mergeForecastResult(queryClient, locationId, horizonDays, event.forecast, row);
              setForecastStockByDin((current) => new Map(current).set(event.din, stockMap.get(event.din)?.quantity ?? null));
              setBulkProgress((current) =>
                current
                  ? { ...current, completed: current.completed + 1, succeeded: current.succeeded + 1 }
                  : current
              );
            }

            if (isBatchErrorEvent(event)) {
              setRowErrors((current) => new Map(current).set(event.din, insufficientDataMessage(event.error)));
              setBulkProgress((current) =>
                current ? { ...current, completed: current.completed + 1, failed: current.failed + 1 } : current
              );
            }

            if (isDoneEvent(event)) {
              setBulkProgress((current) =>
                current
                  ? {
                      ...current,
                      completed: event.total,
                      succeeded: event.succeeded,
                      failed: event.failed,
                      skipped: event.skipped_no_stock
                    }
                  : current
              );
              setToast({
                tone: event.failed > 0 || event.skipped_no_stock > 0 ? "warning" : "success",
                message: bulkDoneMessage(event.succeeded, event.total, event.failed, event.skipped_no_stock)
              });
            }
          }
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          setToast({
            tone: "warning",
            message: `Generation stopped. ${bulkProgress?.succeeded ?? 0} forecasts were updated before cancellation.`
          });
        } else {
          setToast({ tone: "danger", message: forecastErrorMessage(error) });
        }
      } finally {
        abortControllerRef.current = null;
        setGeneratingDins(new Set());
        setBulkProgress(null);
      }
    },
    [bulkProgress?.succeeded, horizonDays, locationId, queryClient, rows, stockMap]
  );

  const requestBulkGeneration = useCallback(() => {
    const target = resolveGenerationTarget(rows, selectedDins, bulkMode, savingDins);

    if (bulkMode === "selected" && target.targetDins.length === 0) {
      setToast({ tone: "warning", message: "Select at least one drug to generate forecasts." });
      pulseSelection();
      return;
    }

    if (target.savingTargetDins.length > 0) {
      setToast({
        tone: "warning",
        message: `${target.savingTargetDins.length} stock update${target.savingTargetDins.length === 1 ? " is" : "s are"} still saving. Try again in a moment.`
      });
      return;
    }

    if (target.stockedDins.length === 0) {
      setToast({
        tone: "warning",
        message: "No stock quantities entered yet. Click the Current Stock column for any drug to enter how many units you have."
      });
      pulseStock();
      return;
    }

    if (target.missingStockDins.length > 0) {
      setConfirmTarget(target);
      return;
    }

    void runBulkGeneration(target.stockedDins);
  }, [bulkMode, rows, runBulkGeneration, savingDins, selectedDins]);

  const cancelBulkGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  function pulseStock() {
    setPulseStockHeader(true);
    window.setTimeout(() => setPulseStockHeader(false), 2000);
  }

  function pulseSelection() {
    setPulseSelectionHeader(true);
    window.setTimeout(() => setPulseSelectionHeader(false), 2000);
  }

  const hasSuccessfulUpload = (uploadsQuery.data ?? []).some((upload: UploadResponse) => upload.status === "SUCCESS");
  const isInitialLoading = forecastsQuery.isLoading || stockQuery.isLoading || locationDrugsQuery.isLoading;
  const loadError = forecastsQuery.error || stockQuery.error || locationDrugsQuery.error;

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Dashboard"
        description="Monitor demand signals, reorder risk, and forecast readiness for the selected pharmacy location."
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" type="button" asChild>
              <Link href="/settings?tab=data">
                <Upload className="h-4 w-4" aria-hidden="true" />
                Upload CSV
              </Link>
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={!rows.some((row) => row.forecast)}
              onClick={() => setToast({ tone: "muted", message: "Purchase order export is not available in this feature yet." })}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export Order
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="Forecast dashboard summary">
        <StatCard title="Tracked Drugs" value={String(stats.tracked)} detail="Forecast or stock rows" icon={Boxes} tone="teal" />
        <StatCard title="Critical" value={String(stats.red)} detail="Red reorder status" icon={AlertTriangle} tone="red" />
        <StatCard title="Reorder" value={String(stats.amber)} detail="Amber watchlist" icon={CalendarClock} tone="amber" />
        <StatCard title="Well Stocked" value={String(stats.green)} detail="Green status" icon={Package} tone="green" />
        <StatCard title="Missing Stock" value={String(stats.missingStock)} detail="Needs current qty" icon={AlertCircle} tone="amber" />
      </section>

      <Card>
        <CardContent className="space-y-4 p-4">
          <DashboardToolbar
            horizonDays={horizonDays}
            setHorizonDays={setHorizonDays}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filters={filters}
            setFilters={setFilters}
            sortKey={sortKey}
            setSortKey={setSortKey}
            therapeuticClasses={therapeuticClasses}
            bulkMode={bulkMode}
            setBulkMode={setBulkMode}
            selectedCount={selectedDins.size}
            clearSelection={() => setSelectedDins(new Set())}
            onGenerate={requestBulkGeneration}
            isGenerating={Boolean(bulkProgress)}
            progress={bulkProgress}
            onCancel={cancelBulkGeneration}
          />

          {isInitialLoading ? (
            <div className="flex min-h-80 items-center justify-center rounded-lg border border-border bg-white">
              <LoadingSpinner label="Loading forecast dashboard" />
            </div>
          ) : loadError ? (
            <EmptyState
              icon={AlertCircle}
              title="Dashboard unavailable"
              description={loadError instanceof Error ? loadError.message : "Unable to load dashboard data."}
            />
          ) : rows.length === 0 ? (
            <DashboardEmptyState hasSuccessfulUpload={hasSuccessfulUpload} />
          ) : visibleRows.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No drugs match your filters"
              description="Clear filters or adjust search to return to your tracked drugs."
              actionLabel="Clear filters"
              className="cursor-pointer"
            />
          ) : (
            <div
              ref={tableParentRef}
              className="max-h-[680px] overflow-auto rounded-lg border border-border bg-white"
              onScroll={(event) => {
                const element = event.currentTarget;
                if (element.scrollTop + element.clientHeight >= element.scrollHeight - 200) {
                  setVisibleLimit((current) => Math.min(current + FORECAST_VISIBLE_INCREMENT, visibleRows.length));
                }
              }}
            >
              <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-slate-50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className={cn("w-12 px-3 py-3", pulseSelectionHeader && "animate-pulse bg-amber-100")}>
                      <span className="sr-only">Select drug</span>
                    </th>
                    <th className="w-64 px-4 py-3 font-medium">Drug</th>
                    <th className={cn("w-40 px-4 py-3 font-medium", pulseStockHeader && "animate-pulse bg-amber-100")}>
                      Current Stock
                    </th>
                    <th className="w-32 px-4 py-3 font-medium">Days Supply</th>
                    <th className="w-40 px-4 py-3 font-medium">Forecasted Demand</th>
                    <th className="w-36 px-4 py-3 font-medium">Confidence</th>
                    <th className="w-40 px-4 py-3 font-medium">Status</th>
                    <th className="w-36 px-4 py-3 font-medium">Last Generated</th>
                    <th className="w-56 px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {tableRows.map((row) => {
                    if (!row) return null;
                    const isSelected = selectedDins.has(row.din);
                    const stale = row.forecast && forecastStockByDin.has(row.din) && forecastStockByDin.get(row.din) !== row.currentStock;

                    return (
                      <ForecastTableRow
                        key={row.din}
                        row={row}
                        horizonDays={horizonDays}
                        selected={isSelected}
                        toggleSelected={() =>
                          setSelectedDins((current) => {
                            const next = new Set(current);
                            if (next.has(row.din)) next.delete(row.din);
                            else next.add(row.din);
                            return next;
                          })
                        }
                        editingStock={editingStock}
                        setEditingStock={setEditingStock}
                        commitStockEdit={commitStockEdit}
                        cancelStockEdit={() => setEditingStock(null)}
                        startEditingStock={startEditingStock}
                        stockInputRefs={stockInputRefs}
                        warning={stockWarnings.get(row.din) ?? null}
                        saved={stockSuccessDins.has(row.din)}
                        saving={savingDins.has(row.din)}
                        locked={isStockLocked(row.din, generatingDins, bulkProgress)}
                        generating={generatingDins.has(row.din)}
                        rowError={rowErrors.get(row.din) ?? null}
                        stale={Boolean(stale)}
                        onGenerate={() => void handleGenerateRow(row)}
                        onExplain={() =>
                          setToast({ tone: "muted", message: "Forecast explanations are not available in this feature yet." })
                        }
                        onOpenDetail={() => setSelectedDetailDin(row.din)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {confirmTarget ? (
        <ConfirmGenerateDialog
          readyCount={confirmTarget.stockedDins.length}
          skippedCount={confirmTarget.missingStockDins.length}
          onClose={() => setConfirmTarget(null)}
          onEnterStockFirst={() => {
            setConfirmTarget(null);
            const firstMissing = confirmTarget.missingStockDins[0];
            if (firstMissing) {
              pulseStock();
              startEditingStock(firstMissing);
            }
          }}
          onGenerate={() => void runBulkGeneration(confirmTarget.stockedDins)}
        />
      ) : null}

      {selectedDetailRow ? (
        <DrugDetailPanel
          row={selectedDetailRow}
          horizonDays={horizonDays}
          stale={forecastStockByDin.get(selectedDetailRow.din) !== selectedDetailRow.currentStock}
          onClose={() => setSelectedDetailDin(null)}
        />
      ) : null}

      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}

function DashboardToolbar({
  horizonDays,
  setHorizonDays,
  searchQuery,
  setSearchQuery,
  filters,
  setFilters,
  sortKey,
  setSortKey,
  therapeuticClasses,
  bulkMode,
  setBulkMode,
  selectedCount,
  clearSelection,
  onGenerate,
  isGenerating,
  progress,
  onCancel
}: {
  horizonDays: number;
  setHorizonDays: (horizonDays: 7 | 14 | 30) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  sortKey: SortKey;
  setSortKey: (sortKey: SortKey) => void;
  therapeuticClasses: string[];
  bulkMode: BulkMode;
  setBulkMode: (bulkMode: BulkMode) => void;
  selectedCount: number;
  clearSelection: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
  progress: BulkProgress | null;
  onCancel: () => void;
}) {
  const progressPercent = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-input bg-white p-1" aria-label="Forecast horizon">
            {HORIZONS.map((horizon) => (
              <button
                key={horizon}
                type="button"
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  horizonDays === horizon ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
                )}
                onClick={() => setHorizonDays(horizon)}
              >
                {horizon} days
              </button>
            ))}
          </div>
          <span className="text-sm font-medium text-slate-700">Showing {horizonDays}-day forecasts</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Bulk generation mode"
            className="h-9 rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={bulkMode}
            onChange={(event) => setBulkMode(event.target.value as BulkMode)}
          >
            <option value="all">All tracked drugs</option>
            <option value="selected">Selected drugs</option>
          </select>
          <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
          {selectedCount > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              Clear selection
            </Button>
          ) : null}
          <Button type="button" variant="teal" disabled={isGenerating} onClick={onGenerate}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Generating... ({progress?.completed ?? 0}/{progress?.total ?? 0})
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden="true" />
                {bulkMode === "selected" ? `Generate Selected (${selectedCount})` : "Generate All"}
              </>
            )}
          </Button>
          {isGenerating ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              <PauseCircle className="h-4 w-4" aria-hidden="true" />
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      {isGenerating ? (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-label="Bulk generation progress">
          <div className="h-full bg-pharma-teal transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(150px,190px))]">
        <label className="relative block">
          <span className="sr-only">Search DIN or drug</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            className="h-9 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search DIN or drug"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Filter by status"
          className="h-9 rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={filters.status}
          onChange={(event) => setFilters({ ...filters, status: event.target.value as FilterState["status"] })}
        >
          <option value="all">All statuses</option>
          <option value="red">Red</option>
          <option value="amber">Amber</option>
          <option value="green">Green</option>
          <option value="notGenerated">Not generated</option>
          <option value="noStock">No stock entered</option>
        </select>
        <select
          aria-label="Filter by confidence"
          className="h-9 rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={filters.confidence}
          onChange={(event) => setFilters({ ...filters, confidence: event.target.value as FilterState["confidence"] })}
        >
          <option value="all">All confidence</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          aria-label="Filter by therapeutic class"
          className="h-9 rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={filters.therapeuticClass}
          onChange={(event) => setFilters({ ...filters, therapeuticClass: event.target.value })}
        >
          <option value="all">All classes</option>
          {therapeuticClasses.map((therapeuticClass) => (
            <option key={therapeuticClass} value={therapeuticClass}>
              {therapeuticClass}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort drugs"
          className="h-9 rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as SortKey)}
        >
          <option value="status">Sort by status</option>
          <option value="drugName">Drug name</option>
          <option value="daysOfSupply">Days of supply</option>
          <option value="predictedQuantity">Predicted quantity</option>
        </select>
      </div>
    </div>
  );
}

function ForecastTableRow({
  row,
  horizonDays,
  selected,
  toggleSelected,
  editingStock,
  setEditingStock,
  commitStockEdit,
  cancelStockEdit,
  startEditingStock,
  stockInputRefs,
  warning,
  saved,
  saving,
  locked,
  generating,
  rowError,
  stale,
  onGenerate,
  onExplain,
  onOpenDetail
}: {
  row: DrugRow;
  horizonDays: number;
  selected: boolean;
  toggleSelected: () => void;
  editingStock: EditingState | null;
  setEditingStock: (editingState: EditingState) => void;
  commitStockEdit: (moveToNext: boolean) => void;
  cancelStockEdit: () => void;
  startEditingStock: (din: string) => void;
  stockInputRefs: React.MutableRefObject<Map<string, HTMLInputElement>>;
  warning: string | null;
  saved: boolean;
  saving: boolean;
  locked: boolean;
  generating: boolean;
  rowError: string | null;
  stale: boolean;
  onGenerate: () => void;
  onExplain: () => void;
  onOpenDetail: () => void;
}) {
  const isEditing = editingStock?.din === row.din;
  const hasStock = isStockEntered(row);
  const status = normalizedReorderStatus(row.forecast?.reorder_status);
  const discontinued = isDiscontinuedStatus(row.drugStatus);

  return (
    <tr
      className={cn("border-b border-border bg-white transition-colors hover:bg-slate-50", status === "RED" && "bg-red-50/30")}
      onClick={onOpenDetail}
    >
      <td className="px-3 py-4" onClick={(event) => event.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={`Select ${row.drugName}`}
          className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
          checked={selected}
          onChange={toggleSelected}
        />
      </td>
      <td className="px-4 py-4">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{formatDrugName(row)}</span>
            {discontinued ? <Badge variant="danger">Discontinued</Badge> : null}
          </div>
          <div className="font-mono text-xs text-muted-foreground">{normalizeDin(row.din) ?? row.din}</div>
          {row.therapeuticClass ? <div className="truncate text-xs text-muted-foreground">{row.therapeuticClass}</div> : null}
        </div>
      </td>
      <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
        {isEditing ? (
          <input
            ref={(element) => {
              if (element) stockInputRefs.current.set(row.din, element);
              else stockInputRefs.current.delete(row.din);
            }}
            aria-label={`Current stock for ${row.drugName}`}
            type="number"
            min="0"
            inputMode="numeric"
            className="h-8 min-w-[72px] rounded-md border border-input bg-white px-2 text-sm outline-none [appearance:textfield] focus:ring-2 focus:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            value={editingStock.value}
            onChange={(event) =>
              setEditingStock({ ...editingStock, value: event.target.value })
            }
            onBlur={() => void commitStockEdit(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void commitStockEdit(false);
              }
              if (event.key === "Tab") {
                event.preventDefault();
                void commitStockEdit(true);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelStockEdit();
              }
            }}
          />
        ) : (
          <button
            type="button"
            disabled={locked}
            className={cn(
              "group inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
              hasStock ? "text-slate-900" : "text-amber-700"
            )}
            onClick={() => startEditingStock(row.din)}
          >
            <span>{hasStock ? `${row.currentStock} units` : "Enter qty"}</span>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            {saved ? <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" /> : null}
            {!saved && !saving ? (
              <Edit3
                className={cn("h-3.5 w-3.5", hasStock ? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" : "opacity-100")}
                aria-hidden="true"
              />
            ) : null}
          </button>
        )}
        {warning ? <div className="mt-1 text-xs font-medium text-red-600">{warning}</div> : null}
      </td>
      <td className="px-4 py-4">
        {generating ? <Loader2 className="h-4 w-4 animate-spin text-pharma-teal" aria-label="Generating forecast" /> : <DaysOfSupply row={row} />}
        {rowError ? <div className="mt-1 text-xs font-medium text-red-600">{rowError}</div> : null}
      </td>
      <td className="px-4 py-4 text-sm text-slate-700">
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin text-pharma-teal" aria-hidden="true" />
        ) : row.forecast?.predicted_quantity !== null && row.forecast?.predicted_quantity !== undefined ? (
          `${row.forecast.predicted_quantity} units / ${horizonDays} days`
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-4">
        {row.forecast?.confidence ? <ConfidenceBadge value={row.forecast.confidence.toLowerCase() as "high" | "medium" | "low"} /> : null}
      </td>
      <td className="px-4 py-4">
        <div className="space-y-1">
          <RowStatusBadge row={row} horizonDays={horizonDays} discontinued={discontinued} />
          {stale ? <Badge variant="warning">Stock changed</Badge> : null}
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-muted-foreground">
        {!hasStock ? "—" : row.forecast?.generated_at ? relativeTime(row.forecast.generated_at) : "Never"}
      </td>
      <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={hasStock ? "teal" : "outline"}
            disabled={!hasStock || generating || saving}
            title={!hasStock ? "Enter current stock first" : undefined}
            onClick={onGenerate}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {row.forecast ? "Regenerate" : "Generate"}
          </Button>
          {row.forecast ? (
            <Button type="button" size="sm" variant="ghost" className="transition-opacity" onClick={onExplain}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Explain
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function DaysOfSupply({ row }: { row: DrugRow }) {
  if (!isStockEntered(row) || row.forecast?.days_of_supply === null || row.forecast?.days_of_supply === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  const days = row.forecast.days_of_supply;
  return (
    <span
      className={cn(
        "font-semibold",
        days < 3 && "text-red-700",
        days >= 3 && days <= 7 && "text-amber-700",
        days > 7 && "text-green-700"
      )}
    >
      {days.toFixed(1)} days
    </span>
  );
}

function RowStatusBadge({
  row,
  horizonDays,
  discontinued
}: {
  row: DrugRow;
  horizonDays: number;
  discontinued: boolean;
}) {
  if (discontinued) {
    return <StatusBadge value="cancelled" />;
  }

  if (!isStockEntered(row)) {
    return <Badge variant="warning">No stock entered</Badge>;
  }

  const status = normalizedReorderStatus(row.forecast?.reorder_status);
  if (status === "RED") return <StatusBadge value="red" />;
  if (status === "AMBER") return <StatusBadge value="amber" />;
  if (status === "GREEN") return <StatusBadge value="ok" />;

  return <Badge variant="muted" title={`No ${horizonDays}-day forecast yet`}>Not generated</Badge>;
}

function DashboardEmptyState({ hasSuccessfulUpload }: { hasSuccessfulUpload: boolean }) {
  if (!hasSuccessfulUpload) {
    return (
      <EmptyState
        icon={Upload}
        title="No dispensing history yet"
        description="Upload your Kroll export so the system can learn your demand patterns."
        actionLabel="Upload dispensing history"
      />
    );
  }

  return (
    <EmptyState
      icon={Package}
      title="No dashboard drugs yet"
      description="Dispensing history has been uploaded, but the current backend only returns drugs after stock or forecasts exist."
    />
  );
}

function ConfirmGenerateDialog({
  readyCount,
  skippedCount,
  onClose,
  onEnterStockFirst,
  onGenerate
}: {
  readyCount: number;
  skippedCount: number;
  onClose: () => void;
  onEnterStockFirst: () => void;
  onGenerate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="generate-dialog-title">
      <div className="w-full max-w-md rounded-lg border border-border bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="generate-dialog-title" className="text-lg font-semibold text-slate-900">
            Generate forecasts?
          </h2>
          <button type="button" aria-label="Close generate dialog" className="rounded-md p-1 hover:bg-muted" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center gap-2 text-green-700">
            <Check className="h-4 w-4" aria-hidden="true" />
            {readyCount} drugs ready
          </div>
          <div className="flex items-center gap-2 text-amber-700">
            <X className="h-4 w-4" aria-hidden="true" />
            {skippedCount} drugs will be skipped because no stock is entered
          </div>
          <p className="rounded-md bg-amber-50 p-3 text-amber-800">Fill in the Current Stock column to include all your drugs.</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onEnterStockFirst}>
            Enter stock first
          </Button>
          <Button type="button" variant="teal" onClick={onGenerate}>
            Generate {readyCount}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function DrugDetailPanel({
  row,
  horizonDays,
  stale,
  onClose
}: {
  row: DrugRow;
  horizonDays: number;
  stale: boolean;
  onClose: () => void;
}) {
  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-border bg-white p-5 shadow-xl" aria-label="Drug detail panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{formatDrugName(row)}</h2>
          <p className="font-mono text-xs text-muted-foreground">{normalizeDin(row.din) ?? row.din}</p>
        </div>
        <button type="button" aria-label="Close drug detail" className="rounded-md p-1 hover:bg-muted" onClick={onClose}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <Detail label="Therapeutic class" value={row.therapeuticClass ?? "Unknown"} />
        <Detail label="Drug status" value={row.drugStatus ?? "Unknown"} />
        <Detail label="Current stock" value={isStockEntered(row) ? `${row.currentStock} units` : "Not entered"} />
        <Detail label="Stock updated" value={row.stockUpdatedAt ? relativeTime(row.stockUpdatedAt) : "—"} />
        <Detail label="Forecast horizon" value={`${horizonDays} days`} />
        <Detail label="Forecast demand" value={row.forecast?.predicted_quantity ? `${row.forecast.predicted_quantity} units` : "Not generated"} />
        <Detail label="Days supply" value={row.forecast?.days_of_supply ? `${row.forecast.days_of_supply.toFixed(1)} days` : "—"} />
        <Detail label="Confidence" value={row.forecast?.confidence ?? "—"} />
      </dl>
      {stale ? (
        <div className="mt-5 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4" aria-hidden="true" />
          Stock changed since this forecast was shown. Regenerate when ready.
        </div>
      ) : null}
    </aside>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function Toast({ toast, onClose }: { toast: NonNullable<ToastState>; onClose: () => void }) {
  return (
    <div
      className={cn(
        "fixed bottom-5 left-1/2 z-50 flex max-w-lg -translate-x-1/2 items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg",
        toast.tone === "success" && "border-green-200 bg-green-50 text-green-800",
        toast.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        toast.tone === "danger" && "border-red-200 bg-red-50 text-red-800",
        toast.tone === "muted" && "border-slate-200 bg-white text-slate-800"
      )}
      role="status"
    >
      <span>{toast.message}</span>
      <button type="button" aria-label="Dismiss notification" className="rounded p-0.5 hover:bg-black/5" onClick={onClose}>
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function mergeForecastResult(
  queryClient: ReturnType<typeof useQueryClient>,
  locationId: string,
  horizonDays: number,
  result: ForecastResult,
  row?: DrugRow | null
) {
  const summary = {
    ...forecastResultToSummary(result),
    drug_name: row?.drugName ?? null,
    strength: row?.strength ?? null,
    current_stock: row?.currentStock ?? null,
    stock_entered: row ? isStockEntered(row) : false,
    threshold: row?.forecast?.threshold ?? null
  };
  queryClient.setQueryData<ForecastSummaryDto[]>(forecastQueryKey(locationId, horizonDays), (current) =>
    mergeForecastSummary(current, summary)
  );
}

function nextVisibleDin(currentDin: string, rows: DrugRow[]) {
  const index = rows.findIndex((row) => row.din === currentDin);
  return index >= 0 ? rows[index + 1]?.din ?? null : null;
}

function isStockLocked(din: string, generatingDins: Set<string>, bulkProgress: BulkProgress | null) {
  return generatingDins.has(din) || Boolean(bulkProgress?.targetDins.includes(din));
}

function stockErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === "STOCK_NOT_SET") {
    return "Enter stock first";
  }
  if (error instanceof ApiError && error.status === 400) {
    return "Check the quantity and try again";
  }
  return "Failed to save stock";
}

function forecastErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === "STOCK_NOT_SET") {
    return "Enter stock first";
  }
  if (error instanceof ApiError && error.code === "NO_STOCK_ENTERED") {
    return "No stock quantities entered yet";
  }
  return "Not enough data";
}

function insufficientDataMessage(error: string) {
  return error === "insufficient_data" ? "Not enough data" : error;
}

function bulkDoneMessage(succeeded: number, total: number, failed: number, skipped: number) {
  const messages = [`Generated ${succeeded} of ${total} drugs.`];
  if (skipped > 0) messages.push(`${skipped} skipped — enter stock to include them.`);
  if (failed > 0) messages.push(`${failed} had insufficient dispensing history.`);
  return messages.join(" ");
}

function formatDrugName(row: DrugRow) {
  return [row.drugName, row.strength].filter(Boolean).join(" ");
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} days ago`;
}