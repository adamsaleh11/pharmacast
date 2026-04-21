"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ChevronRight, Edit3, Info, Loader2, Sparkles, TriangleAlert, X } from "lucide-react";
import { ConfidenceBadge } from "@/components/product/confidence-badge";
import { LoadingSpinner } from "@/components/product/loading-spinner";
import { StatusBadge } from "@/components/product/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { createStockAdjustment, drugDetailQueryKey, getDrugDetail, resetDrugThreshold, upsertDrugThreshold } from "@/lib/api/drug-detail";
import { explainForecast, generateForecast } from "@/lib/api/forecast-dashboard";
import { normalizeDin } from "@/lib/api/drugs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";
import { formatForecastModelPathLabel } from "@/lib/forecast-model-metadata";
import { cn } from "@/lib/utils";
import {
  prependDrugDetailAdjustment,
  setDrugDetailCurrentStock,
  setDrugDetailForecast,
  setDrugDetailThreshold
} from "@/lib/drug-detail-cache";
import type {
  DrugDetailDispensingHistoryDto,
  DrugDetailResponse,
  DrugDetailThresholdDto,
  SafetyMultiplier
} from "@/types/drug-detail";

type DrugDetailPanelProps = {
  open: boolean;
  locationId: string | null;
  din: string | null;
  horizonDays: number;
  onOpenChange: (open: boolean) => void;
  onStockSaved?: (din: string, quantity: number | null, updatedAt: string | null) => void;
};

type ThresholdDraft = {
  lead_time_days: string;
  red_threshold_days: string;
  amber_threshold_days: string;
  safety_multiplier: SafetyMultiplier;
  notifications_enabled: boolean;
};

const DEFAULT_THRESHOLD_DRAFT: ThresholdDraft = {
  lead_time_days: "2",
  red_threshold_days: "3",
  amber_threshold_days: "7",
  safety_multiplier: "BALANCED",
  notifications_enabled: true
};

async function getDashboardAccessToken(label: string) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const accessToken = await getBackendAccessToken(supabase, label);

  if (!accessToken) {
    throw new Error("You must be signed in to view this drug detail.");
  }

  return accessToken;
}

function formatRelativeTime(value: string) {
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

function formatWeekLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isDiscontinuedStatus(status: string | null | undefined) {
  return status === "CANCELLED" || status === "DORMANT";
}

function mapThresholdToDraft(threshold: DrugDetailThresholdDto | null): ThresholdDraft {
  if (!threshold) {
    return { ...DEFAULT_THRESHOLD_DRAFT };
  }

  return {
    lead_time_days: String(threshold.lead_time_days),
    red_threshold_days: String(threshold.red_threshold_days),
    amber_threshold_days: String(threshold.amber_threshold_days),
    safety_multiplier: threshold.safety_multiplier,
    notifications_enabled: threshold.notifications_enabled
  };
}

function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return null;
  }
  return Number(trimmed);
}

function parseNonNegativeInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return null;
  }
  return Number(trimmed);
}

function getThresholdValidationError(draft: ThresholdDraft) {
  const leadTime = parsePositiveInt(draft.lead_time_days);
  if (leadTime === null || leadTime < 1 || leadTime > 30) {
    return "Lead time must be between 1 and 30 days.";
  }

  const red = parseNonNegativeInt(draft.red_threshold_days);
  const amber = parseNonNegativeInt(draft.amber_threshold_days);

  if (red === null || amber === null) {
    return "Thresholds must be whole numbers.";
  }

  if (red >= amber) {
    return "Red threshold must be lower than amber.";
  }

  return null;
}

function extractExplanationText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const candidate = record.explanation ?? record.text ?? record.message ?? record.content;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "Explanation received.";
    }
  }

  return "Explanation received.";
}

function chartPointToY(value: number, max: number, height: number) {
  const paddedMax = Math.max(max, 1);
  const ratio = value / paddedMax;
  return height - ratio * height;
}

function buildForecastSeries(detail: DrugDetailResponse): number[] {
  if (!detail.latest_forecast) {
    return [];
  }

  const { predicted_quantity, forecast_horizon_days, avg_daily_demand } = detail.latest_forecast;
  const weeklyDemand = avg_daily_demand * 7;
  const base = forecast_horizon_days > 0 ? (predicted_quantity / forecast_horizon_days) * 7 : weeklyDemand;
  const estimate = Number.isFinite(base) && base > 0 ? base : weeklyDemand;

  return [estimate, estimate, estimate, estimate];
}

function sortWeeklyHistory(history: DrugDetailDispensingHistoryDto[]) {
  return [...history].sort((left, right) => new Date(left.week).getTime() - new Date(right.week).getTime());
}

export function DrugDetailPanel({
  open,
  locationId,
  din,
  horizonDays,
  onOpenChange,
  onStockSaved
}: DrugDetailPanelProps) {
  const queryClient = useQueryClient();
  const selectedDin = normalizeDin(din) ?? din?.trim() ?? null;
  const [tab, setTab] = useState("overview");
  const [stockEditing, setStockEditing] = useState(false);
  const [stockDraft, setStockDraft] = useState("");
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockSaved, setStockSaved] = useState(false);
  const [explanationText, setExplanationText] = useState<string | null>(null);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const stockInputRef = useRef<HTMLInputElement>(null);

  const detailQuery = useQuery({
    queryKey: drugDetailQueryKey(locationId, selectedDin),
    enabled: open && Boolean(locationId && selectedDin),
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const accessToken = await getDashboardAccessToken("drug-detail");
      try {
        return await getDrugDetail(locationId ?? "", selectedDin ?? "", accessToken);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    }
  });

  const detail = detailQuery.data ?? null;
  const currentStock = detail?.current_stock ?? null;
  const currentUpdatedAt = detail?.stock_last_updated ?? null;
  const forecast = detail?.latest_forecast ?? null;
  const threshold = detail?.threshold ?? null;
  const history = detail?.dispensing_history;
  const adjustments = detail?.stock_adjustments ?? [];

  useEffect(() => {
    if (!stockSaved) {
      return;
    }
    const timeout = window.setTimeout(() => setStockSaved(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [stockSaved]);

  useEffect(() => {
    if (!stockEditing) {
      return;
    }
    window.setTimeout(() => {
      stockInputRef.current?.focus();
      stockInputRef.current?.select();
    }, 0);
  }, [stockEditing]);

  const saveStockMutation = useMutation({
    retry: false,
    mutationFn: async ({ quantity }: { quantity: number }) => {
      const accessToken = await getDashboardAccessToken("drug-detail-stock-save");
      return upsertCurrentStock(locationId ?? "", selectedDin ?? "", quantity, accessToken);
    }
  });

  const generateForecastMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const accessToken = await getDashboardAccessToken("drug-detail-generate-forecast");
      return generateForecast(locationId ?? "", selectedDin ?? "", horizonDays, accessToken);
    }
  });

  const explainMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const accessToken = await getDashboardAccessToken("drug-detail-explain-forecast");
      return explainForecast(locationId ?? "", selectedDin ?? "", accessToken);
    }
  });

  const adjustmentMutation = useMutation({
    retry: false,
    mutationFn: async (body: { adjustment_quantity: number; note: string }) => {
      const accessToken = await getDashboardAccessToken("drug-detail-adjustment-save");
      return createStockAdjustment(locationId ?? "", selectedDin ?? "", body, accessToken);
    }
  });

  const actualSeries = useMemo(() => sortWeeklyHistory(history ?? []).slice(-12), [history]);
  const forecastSeries = useMemo(() => (detail ? buildForecastSeries(detail) : []), [detail]);

  function syncDetailStock(quantity: number | null, updatedAt: string | null) {
    if (!locationId || !selectedDin) {
      return;
    }
    setDrugDetailCurrentStock(queryClient, locationId, selectedDin, quantity, updatedAt);
    onStockSaved?.(selectedDin, quantity, updatedAt);
  }

  async function commitStockEdit() {
    setStockError(null);
    const validationMessage = stockDraft.trim() === "" ? null : /^\d+$/.test(stockDraft.trim()) ? null : "Enter a whole number.";
    if (validationMessage) {
      setStockError(validationMessage);
      return;
    }

    const quantity = stockDraft.trim() === "" ? null : Number(stockDraft.trim());
    if (quantity === null) {
      setStockEditing(false);
      return;
    }

    const previousStock = currentStock;
    const previousUpdatedAt = currentUpdatedAt;
    const optimisticUpdatedAt = new Date().toISOString();
    if (locationId && selectedDin) {
      setDrugDetailCurrentStock(queryClient, locationId, selectedDin, quantity, optimisticUpdatedAt);
      onStockSaved?.(selectedDin, quantity, optimisticUpdatedAt);
    }

    try {
      const saved = await saveStockMutation.mutateAsync({ quantity });
      syncDetailStock(saved.quantity, saved.updated_at);
      setStockDraft(String(saved.quantity));
      setStockSaved(true);
      setStockEditing(false);
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: ["stock", locationId] as const });
      }
      setStockError(null);
    } catch (error) {
      if (locationId && selectedDin) {
        setDrugDetailCurrentStock(queryClient, locationId, selectedDin, previousStock, previousUpdatedAt);
        onStockSaved?.(selectedDin, previousStock, previousUpdatedAt);
      }
      setStockError(error instanceof ApiError && error.status === 400 ? "Check the quantity and try again." : "Failed to save stock.");
    }
  }

  async function handleGenerateForecast() {
    if (!locationId || !selectedDin) {
      return;
    }

    try {
      const result = await generateForecastMutation.mutateAsync();
      setDrugDetailForecast(queryClient, locationId, result);
      queryClient.invalidateQueries({ queryKey: ["forecasts", locationId, horizonDays] as const });
      setExplanationText(null);
      setExplanationError(null);
    } catch (error) {
      setExplanationError(error instanceof Error ? error.message : "Failed to generate forecast.");
    }
  }

  async function handleExplainForecast() {
    if (!locationId || !selectedDin) {
      return;
    }

    setExplanationError(null);

    try {
      const response = await explainMutation.mutateAsync();
      setExplanationText(extractExplanationText(response));
    } catch (error) {
      setExplanationError(error instanceof Error ? error.message : "Forecast explanation is unavailable.");
    }
  }

  async function handleAddAdjustment() {
    const quantityField = adjustmentQuantityRef.current?.value ?? "";
    const noteField = adjustmentNoteRef.current?.value ?? "";
    const trimmedQuantity = quantityField.trim();
    const note = noteField.trim();

    if (!trimmedQuantity || !/^[+-]?\d+$/.test(trimmedQuantity)) {
      setAdjustmentError("Enter a whole number quantity.");
      return;
    }

    const quantity = Number(trimmedQuantity);

    if (!note) {
      setAdjustmentError("Note is required.");
      return;
    }

    if (!locationId || !selectedDin) {
      return;
    }

    setAdjustmentError(null);

    try {
      const response = await adjustmentMutation.mutateAsync({ adjustment_quantity: quantity, note });
      prependDrugDetailAdjustment(queryClient, locationId, selectedDin, response.adjustment);
      adjustmentQuantityRef.current!.value = "";
      adjustmentNoteRef.current!.value = "";
      setAdjustmentFeedback("Note added");
    } catch (error) {
      setAdjustmentError(error instanceof Error ? error.message : "Failed to add adjustment.");
    }
  }

  const adjustmentQuantityRef = useRef<HTMLInputElement>(null);
  const adjustmentNoteRef = useRef<HTMLTextAreaElement>(null);
  const [adjustmentFeedback, setAdjustmentFeedback] = useState<string | null>(null);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);

  useEffect(() => {
    if (!adjustmentFeedback) {
      return;
    }
    const timeout = window.setTimeout(() => setAdjustmentFeedback(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [adjustmentFeedback]);

  const forecastStatus = forecast?.reorder_status;
  const forecastBadge =
    forecastStatus === "RED" ? (
      <StatusBadge value="red" />
    ) : forecastStatus === "AMBER" ? (
      <StatusBadge value="amber" />
    ) : forecastStatus === "GREEN" ? (
      <StatusBadge value="ok" />
    ) : (
      <Badge variant="muted">No forecast</Badge>
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col p-0 sm:w-[480px] sm:max-w-[480px]">
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <SheetHeader className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <SheetTitle className="text-xl">
                    {detail ? `${detail.drug.name} ${detail.drug.strength}` : "Drug detail"}
                  </SheetTitle>
                  <p className="font-mono text-xs text-muted-foreground">{selectedDin ?? "—"}</p>
                </div>
                <button
                  type="button"
                  aria-label="Close drug detail panel"
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {forecastBadge}
                {detail && isDiscontinuedStatus(detail.drug.status) ? (
                  <Badge variant="danger" className="gap-1">
                    <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    Discontinued
                  </Badge>
                ) : null}
              </div>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {!locationId ? (
              <div className="flex min-h-80 items-center justify-center rounded-lg border border-border bg-white">
                <LoadingSpinner label="Choose a location" />
              </div>
            ) : detailQuery.isLoading ? (
              <div className="flex min-h-80 items-center justify-center rounded-lg border border-border bg-white">
                <LoadingSpinner label="Loading drug detail" />
              </div>
            ) : detailQuery.isError ? (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start gap-2 text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="font-medium">Unable to load drug detail.</p>
                      <p className="text-sm text-muted-foreground">
                        {detailQuery.error instanceof Error ? detailQuery.error.message : "Try again."}
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" onClick={() => void detailQuery.refetch()}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : detailQuery.data === null ? (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start gap-2 text-slate-700">
                    <Info className="mt-0.5 h-4 w-4" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="font-medium">Drug detail unavailable.</p>
                      <p className="text-sm text-muted-foreground">
                        The backend does not have a catalog record for this DIN yet, so the detail panel can only show
                        limited information.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : detail ? (
              <Tabs defaultValue="overview" value={tab} onValueChange={setTab}>
                <div className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
                    <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      {detail.drug.therapeutic_class} • {detail.drug.form} • {detail.drug.manufacturer} • Health Canada {detail.drug.status}
                    </div>

                    <Card className={cn("border-amber-200 bg-amber-50/70", currentStock !== null && "border-border bg-card")}>
                      <CardHeader className="space-y-2">
                        <CardTitle>Current Stock</CardTitle>
                        <CardDescription>
                          {currentStock !== null
                            ? currentUpdatedAt
                              ? `Updated ${formatRelativeTime(currentUpdatedAt)}`
                              : "Current stock recorded"
                            : "Required to generate forecasts"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {stockEditing ? (
                          <div className="space-y-2">
                            <Input
                              ref={stockInputRef}
                              aria-label="Current stock quantity"
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={stockDraft}
                              onChange={(event) => setStockDraft(event.target.value)}
                              onBlur={() => void commitStockEdit()}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void commitStockEdit();
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  setStockEditing(false);
                                  setStockDraft(currentStock === null ? "" : String(currentStock));
                                }
                              }}
                            />
                            <div className="text-xs text-muted-foreground">Press Enter to save.</div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors",
                              currentStock === null
                                ? "border-amber-300 bg-white text-amber-700 hover:bg-amber-50"
                                : "border-border bg-white text-foreground hover:bg-muted"
                            )}
                            onClick={() => {
                              setStockEditing(true);
                              setStockDraft(currentStock === null ? "" : String(currentStock));
                            }}
                          >
                            <span className="text-lg font-semibold">
                              {currentStock === null ? "Enter quantity" : `${currentStock} units`}
                            </span>
                            {saveStockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                            {stockSaved ? <Check className="h-4 w-4 text-teal-600" aria-hidden="true" /> : null}
                            <Edit3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          </button>
                        )}
                        {stockError ? <p className="text-sm font-medium text-red-600">{stockError}</p> : null}
                        {!stockEditing && currentStock === null ? (
                          <p className="text-sm text-amber-700">Enter current stock above to generate a forecast.</p>
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="space-y-2">
                        <CardTitle>Forecast</CardTitle>
                        <CardDescription>
                          {currentStock === null
                            ? "Enter current stock above to generate a forecast."
                            : forecast
                              ? `Predicted demand: ${forecast.predicted_quantity} units / ${forecast.forecast_horizon_days} days`
                              : "No forecast yet"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {currentStock !== null ? (
                          forecast ? (
                            <div className="space-y-3">
                              <div className="grid gap-3 text-sm sm:grid-cols-3">
                                <div>
                                  <div className="text-xs uppercase text-muted-foreground">Predicted demand</div>
                                  <div className="mt-1 font-medium">{forecast.predicted_quantity} units / {forecast.forecast_horizon_days} days</div>
                                </div>
                                <div>
                                  <div className="text-xs uppercase text-muted-foreground">Days of supply</div>
                                  <div
                                    className={cn(
                                      "mt-1 font-semibold",
                                      forecast.days_of_supply < 3 && "text-red-700",
                                      forecast.days_of_supply >= 3 && forecast.days_of_supply <= 7 && "text-amber-700",
                                      forecast.days_of_supply > 7 && "text-green-700"
                                    )}
                                  >
                                    {forecast.days_of_supply.toFixed(1)} days
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs uppercase text-muted-foreground">Confidence</div>
                                  <div className="mt-1">
                                    <ConfidenceBadge value={forecast.confidence.toLowerCase() as "high" | "medium" | "low"} />
                                  </div>
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">Last generated {formatRelativeTime(forecast.generated_at)}</div>
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="muted">Model: {formatForecastModelPathLabel(forecast.model_path)}</Badge>
                              </div>
                              <Button type="button" variant="teal" onClick={() => void handleGenerateForecast()}>
                                {generateForecastMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    Regenerating...
                                  </>
                                ) : (
                                  <>
                                    Regenerate
                                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                  </>
                                )}
                              </Button>
                            </div>
                          ) : (
                            <Button type="button" variant="teal" onClick={() => void handleGenerateForecast()}>
                              {generateForecastMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  Generate forecast
                                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                </>
                              )}
                            </Button>
                          )
                        ) : (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            Enter current stock above to generate a forecast.
                          </div>
                        )}

                        <ForecastChart actual={actualSeries} forecastValues={forecastSeries} />

                        {forecast ? (
                          <div className="space-y-3">
                            <Button type="button" variant="ghost" className="px-0 text-teal-700 hover:bg-transparent hover:text-teal-800" onClick={() => void handleExplainForecast()}>
                              <Sparkles className="h-4 w-4" aria-hidden="true" />
                              Explain this forecast
                            </Button>
                            {explainMutation.isPending ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                Preparing explanation...
                              </div>
                            ) : null}
                            {explanationError ? (
                              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                                {explanationError}
                              </div>
                            ) : null}
                            {explanationText ? (
                              <div className="border-l-4 border-teal-500 bg-teal-50 px-3 py-2 text-sm text-slate-800">
                                {explanationText}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="thresholds" className="space-y-4">
                    <ThresholdTab locationId={locationId} din={selectedDin} threshold={threshold} />
                  </TabsContent>

                  <TabsContent value="adjustments" className="space-y-4">
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Adjustments are audit notes only. To change your current stock for forecasting, edit the stock number in the Overview tab or directly in the dashboard.
                    </div>

                    <Card>
                      <CardHeader className="space-y-2">
                        <CardTitle>Add note</CardTitle>
                        <CardDescription>Positive values mean received stock. Negative values mean removed or expired stock.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-foreground">+/- quantity</label>
                            <Input ref={adjustmentQuantityRef} type="number" placeholder="0" />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-foreground">Note (required)</label>
                            <Textarea ref={adjustmentNoteRef} rows={3} placeholder="McKesson delivery Jan 15" />
                          </div>
                        </div>
                        {adjustmentError ? <p className="text-sm font-medium text-red-600">{adjustmentError}</p> : null}
                        {adjustmentFeedback ? <p className="text-sm font-medium text-teal-700">{adjustmentFeedback}</p> : null}
                        <Button type="button" variant="teal" onClick={() => void handleAddAdjustment()} disabled={adjustmentMutation.isPending}>
                          {adjustmentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                          Add note
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="space-y-2">
                        <CardTitle>Adjustment history</CardTitle>
                        <CardDescription>Last 10 adjustment notes.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {adjustments.length === 0 ? (
                          <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                            No adjustment notes yet.
                          </div>
                        ) : (
                          adjustments.map((adjustment) => (
                            <div key={`${adjustment.adjusted_at}-${adjustment.note}`} className="flex items-start justify-between gap-4 rounded-md border border-border bg-white px-3 py-3 text-sm">
                              <div className="min-w-0">
                                <div className="font-medium text-foreground">{formatRelativeTime(adjustment.adjusted_at)}</div>
                                <div className="mt-1 text-muted-foreground">{adjustment.note}</div>
                              </div>
                              <div
                                className={cn(
                                  "shrink-0 font-semibold",
                                  adjustment.adjustment_quantity > 0 && "text-green-700",
                                  adjustment.adjustment_quantity < 0 && "text-red-700",
                                  adjustment.adjustment_quantity === 0 && "text-muted-foreground"
                                )}
                              >
                                {adjustment.adjustment_quantity > 0 ? "+" : ""}
                                {adjustment.adjustment_quantity}
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Info className="h-4 w-4" aria-hidden="true" />
                    Drug detail is unavailable.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ForecastChart({
  actual,
  forecastValues
}: {
  actual: DrugDetailDispensingHistoryDto[];
  forecastValues: number[];
}) {
  const width = 640;
  const height = 220;
  const chartHeight = 150;
  const actualCount = actual.length;
  const forecastCount = forecastValues.length;
  const totalCount = actualCount + forecastCount;
  const maxValue = Math.max(...actual.map((entry) => entry.quantity), ...forecastValues, 1);

  if (totalCount === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-10 text-center text-sm text-muted-foreground">
        No dispensing history yet.
      </div>
    );
  }

  const segmentWidth = width / totalCount;
  const barWidth = Math.max(10, segmentWidth * 0.55);
  const forecastPoints = forecastValues.map((value, index) => {
    const x = (actualCount + index) * segmentWidth + segmentWidth / 2;
    const y = chartPointToY(value, maxValue, chartHeight);
    return `${x},${y}`;
  });

  return (
    <div className="space-y-2 rounded-lg border border-border bg-white p-3">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
          <line
            x1={(actualCount / totalCount) * width}
            x2={(actualCount / totalCount) * width}
            y1={14}
            y2={chartHeight}
            stroke="rgb(148 163 184)"
            strokeDasharray="6 6"
          />
          {actual.map((entry, index) => {
            const x = index * segmentWidth + (segmentWidth - barWidth) / 2;
            const barHeight = chartHeight - chartPointToY(entry.quantity, maxValue, chartHeight);
            const y = chartHeight - barHeight;
            return (
              <g key={`${entry.week}-${index}`}>
                <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" fill="rgb(30 58 138)" />
              </g>
            );
          })}
          {forecastValues.length > 0 ? (
            <polyline
              points={forecastPoints.join(" ")}
              fill="none"
              stroke="rgb(13 148 136)"
              strokeWidth="3"
              strokeDasharray="8 6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {forecastValues.map((value, index) => {
            const x = (actualCount + index) * segmentWidth + segmentWidth / 2;
            const y = chartPointToY(value, maxValue, chartHeight);
            return <circle key={`forecast-${index}`} cx={x} cy={y} r="3.5" fill="rgb(13 148 136)" />;
          })}
        </svg>
      </div>
      <div className="grid text-[11px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${totalCount}, minmax(0, 1fr))` }}>
        {actual.map((entry) => (
          <div key={entry.week} className="truncate text-center">
            {formatWeekLabel(entry.week)}
          </div>
        ))}
        {forecastValues.map((_, index) => (
          <div key={`forecast-label-${index}`} className="truncate text-center">
            +{index + 1}w
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-800" aria-hidden="true" />
          Actual dispensing
        </div>
        <div className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-teal-600" aria-hidden="true" />
          Forecast (est.)
        </div>
      </div>
    </div>
  );
}

function ThresholdTab({
  locationId,
  din,
  threshold
}: {
  locationId: string | null;
  din: string | null;
  threshold: DrugDetailThresholdDto | null;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ThresholdDraft>(() => mapThresholdToDraft(threshold));
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const committedSnapshotRef = useRef(JSON.stringify(mapThresholdToDraft(threshold)));

  const thresholdMutation = useMutation({
    retry: false,
    mutationFn: async (nextDraft: ThresholdDraft) => {
      const accessToken = await getDashboardAccessToken("drug-detail-threshold-save");
      return upsertDrugThreshold(
        locationId ?? "",
        din ?? "",
        {
          lead_time_days: Number(nextDraft.lead_time_days),
          red_threshold_days: Number(nextDraft.red_threshold_days),
          amber_threshold_days: Number(nextDraft.amber_threshold_days),
          safety_multiplier: nextDraft.safety_multiplier,
          notifications_enabled: nextDraft.notifications_enabled
        },
        accessToken
      );
    }
  });

  const resetThresholdMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const accessToken = await getDashboardAccessToken("drug-detail-threshold-reset");
      return resetDrugThreshold(locationId ?? "", din ?? "", accessToken);
    }
  });

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeout = window.setTimeout(() => setFeedback(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  function clearPendingSave() {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }

  function queueSave(nextDraft: ThresholdDraft) {
    clearPendingSave();

    const validation = getThresholdValidationError(nextDraft);
    if (validation) {
      setError(validation);
      return;
    }

    setError(null);

    const snapshot = JSON.stringify(nextDraft);
    if (snapshot === committedSnapshotRef.current) {
      return;
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      void saveThreshold(nextDraft);
    }, 500);
  }

  async function saveThreshold(nextDraft: ThresholdDraft) {
    if (!locationId || !din) {
      return;
    }

    try {
      const saved = await thresholdMutation.mutateAsync(nextDraft);
      setDrugDetailThreshold(queryClient, locationId, din, saved);
      committedSnapshotRef.current = JSON.stringify(nextDraft);
      setFeedback("✓ Saved");
      queryClient.invalidateQueries({ queryKey: drugDetailQueryKey(locationId, din) });
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to save threshold.");
    }
  }

  async function handleReset() {
    if (!locationId || !din) {
      return;
    }

    clearPendingSave();

    try {
      await resetThresholdMutation.mutateAsync();
      const nextDraft = { ...DEFAULT_THRESHOLD_DRAFT };
      setDraft(nextDraft);
      committedSnapshotRef.current = JSON.stringify(nextDraft);
      setDrugDetailThreshold(queryClient, locationId, din, null);
      setFeedback("Reset to defaults");
      queryClient.invalidateQueries({ queryKey: drugDetailQueryKey(locationId, din) });
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to reset threshold.");
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle>Thresholds</CardTitle>
        <CardDescription>Autosaves after a short pause when you change a field.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            How many days does this drug take to arrive from your supplier?
          </label>
          <Input
            type="number"
            min={1}
            max={30}
            value={draft.lead_time_days}
            onChange={(event) => {
              const nextDraft = { ...draft, lead_time_days: event.target.value };
              setDraft(nextDraft);
              queueSave(nextDraft);
            }}
          />
          <p className="text-xs text-muted-foreground">Default: 2 days</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">Safety buffer</label>
          <div className="inline-flex rounded-md border border-input bg-white p-1">
            {(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"] as SafetyMultiplier[]).map((value) => (
              <button
                key={value}
                type="button"
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  draft.safety_multiplier === value ? "bg-pharma-teal text-white" : "text-muted-foreground hover:bg-muted"
                )}
                onClick={() => {
                  const nextDraft = { ...draft, safety_multiplier: value };
                  setDraft(nextDraft);
                  queueSave(nextDraft);
                }}
              >
                {value.charAt(0) + value.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Conservative = 1.5× lead time, Balanced = 1×, Aggressive = 0.75×</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Send a critical alert when days of supply falls below
          </label>
          <Input
            type="number"
            min={0}
            value={draft.red_threshold_days}
            onChange={(event) => {
              const nextDraft = { ...draft, red_threshold_days: event.target.value };
              setDraft(nextDraft);
              queueSave(nextDraft);
            }}
          />
          <p className="text-xs text-muted-foreground">Default: 3 days. Must be less than amber threshold.</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Send a warning when days of supply falls below
          </label>
          <Input
            type="number"
            min={0}
            value={draft.amber_threshold_days}
            onChange={(event) => {
              const nextDraft = { ...draft, amber_threshold_days: event.target.value };
              setDraft(nextDraft);
              queueSave(nextDraft);
            }}
          />
          <p className="text-xs text-muted-foreground">Default: 7 days.</p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-white px-3 py-3">
          <div>
            <div className="text-sm font-medium text-foreground">Send email alerts for this drug</div>
            <p className="text-xs text-muted-foreground">Turn alerts on or off for this threshold.</p>
          </div>
          <Switch
            checked={draft.notifications_enabled}
            onCheckedChange={(checked) => {
              const nextDraft = { ...draft, notifications_enabled: checked };
              setDraft(nextDraft);
              queueSave(nextDraft);
            }}
            aria-label="Send email alerts for this drug"
          />
        </div>

        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        {feedback ? <p className="text-sm font-medium text-teal-700">{feedback}</p> : null}

        <button
          type="button"
          className="text-sm font-medium text-muted-foreground underline decoration-muted-foreground/40 underline-offset-4 hover:text-foreground"
          onClick={() => void handleReset()}
        >
          Reset to system defaults
        </button>
      </CardContent>
    </Card>
  );
}
