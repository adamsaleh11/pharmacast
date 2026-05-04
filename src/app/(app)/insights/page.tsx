"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  XAxis,
  YAxis
} from "recharts";
import { AlertTriangle, HelpCircle, Info, TrendingDown, TrendingUp } from "lucide-react";
import { AppPageHeader } from "@/components/product/app-page-header";
import { SectionCard } from "@/components/product/section-card";
import { Button } from "@/components/ui/button";
import {
  getAccuracyInsights,
  getHealthScoreInsights,
  getSavingsInsights,
  getTrendsInsights,
  INSIGHTS_STALE_TIME_MS,
  insightsQueryKeys
} from "@/lib/api/insights";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/providers/app-context";
import type {
  AccuracyInsightsResponse,
  DemandChange,
  HealthScoreResponse,
  InsightsPeriod,
  SavingsInsightsResponse,
  TrendsInsightsResponse,
  WeeklyTotal
} from "@/types/insights";

const PERIOD_OPTIONS: { label: string; value: InsightsPeriod }[] = [
  { label: "Last 30 days", value: 30 },
  { label: "Last 60 days", value: 60 },
  { label: "Last 90 days", value: 90 }
];

const moneyFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0
});

function getInsightsAccessToken(label: string) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return getBackendAccessToken(supabase, label);
}

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" ? `${Math.round(value)}%` : "-";
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreColor(score: number) {
  if (score > 75) {
    return "#16A34A";
  }
  if (score >= 50) {
    return "#D97706";
  }
  return "#DC2626";
}

export default function InsightsPage() {
  const [period, setPeriod] = useState<InsightsPeriod>(30);
  const queryClient = useQueryClient();
  const { authReady, currentLocation } = useAppContext();
  const locationId = currentLocation?.id;

  const savingsQuery = useQuery({
    queryKey: locationId ? insightsQueryKeys.savings(locationId, period) : ["insights", "savings", "missing", period],
    enabled: Boolean(locationId),
    staleTime: INSIGHTS_STALE_TIME_MS,
    queryFn: async () => {
      if (!locationId) {
        throw new Error("Select a location to load insights.");
      }
      const accessToken = await getInsightsAccessToken("insights-savings");
      if (!accessToken) {
        throw new Error("You must be signed in to view insights.");
      }
      return getSavingsInsights(locationId, period, accessToken);
    }
  });

  const accuracyQuery = useQuery({
    queryKey: locationId ? insightsQueryKeys.accuracy(locationId, period) : ["insights", "accuracy", "missing", period],
    enabled: Boolean(locationId),
    staleTime: INSIGHTS_STALE_TIME_MS,
    queryFn: async () => {
      if (!locationId) {
        throw new Error("Select a location to load insights.");
      }
      const accessToken = await getInsightsAccessToken("insights-accuracy");
      if (!accessToken) {
        throw new Error("You must be signed in to view insights.");
      }
      return getAccuracyInsights(locationId, period, accessToken);
    }
  });

  const trendsQuery = useQuery({
    queryKey: locationId ? insightsQueryKeys.trends(locationId, period) : ["insights", "trends", "missing", period],
    enabled: Boolean(locationId),
    staleTime: INSIGHTS_STALE_TIME_MS,
    queryFn: async () => {
      if (!locationId) {
        throw new Error("Select a location to load insights.");
      }
      const accessToken = await getInsightsAccessToken("insights-trends");
      if (!accessToken) {
        throw new Error("You must be signed in to view insights.");
      }
      return getTrendsInsights(locationId, period, accessToken);
    }
  });

  const healthScoreQuery = useQuery({
    queryKey: locationId ? insightsQueryKeys.healthScore(locationId) : ["insights", "healthScore", "missing"],
    enabled: Boolean(locationId),
    staleTime: INSIGHTS_STALE_TIME_MS,
    queryFn: async () => {
      if (!locationId) {
        throw new Error("Select a location to load insights.");
      }
      const accessToken = await getInsightsAccessToken("insights-health-score");
      if (!accessToken) {
        throw new Error("You must be signed in to view insights.");
      }
      return getHealthScoreInsights(locationId, accessToken);
    }
  });

  function selectPeriod(nextPeriod: InsightsPeriod) {
    setPeriod(nextPeriod);
    void queryClient.invalidateQueries({ queryKey: insightsQueryKeys.root });
  }

  if (authReady && !currentLocation) {
    return (
      <div className="space-y-6">
        <AppPageHeader title="Insights" description="Analytics, savings proof, and demand trends for your pharmacy." />
        <SectionCard title="No location selected" description="Choose or create a pharmacy location before viewing insights.">
          <p className="text-sm text-muted-foreground">Insights are scoped to a single location to keep pharmacy data isolated.</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <AppPageHeader
          title="Insights"
          description="Savings proof, inventory health, and demand trends for the selected location."
        />
        <div className="inline-flex w-full rounded-lg border border-border bg-white p-1 shadow-sm sm:w-auto" aria-label="Insights period">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => selectPeriod(option.value)}
              className={cn(
                "min-h-10 flex-1 rounded-md px-3 text-sm font-medium text-muted-foreground transition sm:flex-none",
                period === option.value ? "bg-primary text-white shadow-sm" : "hover:bg-muted hover:text-foreground"
              )}
              aria-pressed={period === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <SavingsSection query={savingsQuery} />
      {savingsQuery.data?.data_quality_message ? <DataQualityBanner message={savingsQuery.data.data_quality_message} /> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <HealthScoreSection query={healthScoreQuery} />
        <AccuracySection query={accuracyQuery} />
      </div>

      <TrendsSection query={trendsQuery} />
    </div>
  );
}

type QueryState<T> = {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

function SavingsSection({ query }: { query: QueryState<SavingsInsightsResponse> }) {
  return (
    <SectionCard title="Estimated savings this period" description="Based on variance between AI-recommended and actual orders">
      {query.isLoading ? <SavingsSkeleton /> : null}
      {query.isError ? <SectionError message={query.error?.message ?? "Unable to load savings insights."} /> : null}
      {query.data ? <SavingsContent savings={query.data} /> : null}
    </SectionCard>
  );
}

function SavingsContent({ savings }: { savings: SavingsInsightsResponse }) {
  const hasSavingsValue = typeof savings.total_savings === "number";

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-white p-5 ring-1 ring-emerald-100">
        {hasSavingsValue ? (
          <>
            <p className="text-5xl font-semibold tracking-normal text-green-700 sm:text-6xl">
              {formatMoney(savings.total_savings ?? 0)}
            </p>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Based on variance between AI-recommended and actual orders
            </p>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-3xl font-semibold tracking-normal text-foreground">Unlock savings tracking</p>
            <Link href="/help/kroll-export" className="inline-flex text-sm font-medium text-pharma-teal hover:underline">
              Add cost_per_unit to your Kroll export →
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <SavingsBucket title="Overstock" subtitle="Avoided">
          {typeof savings.overstock_avoided.value === "number" ? (
            <SavingsValue>{formatMoney(savings.overstock_avoided.value)}</SavingsValue>
          ) : savings.overstock_avoided.requires_cost_data ? (
            <Link href="/help/kroll-export" className="text-sm font-medium text-amber-700 hover:underline">
              Add cost data to unlock
            </Link>
          ) : (
            <MutedDash />
          )}
        </SavingsBucket>
        <SavingsBucket title="Waste" subtitle="Eliminated">
          {typeof savings.waste_eliminated.value === "number" ? (
            <SavingsValue>{formatMoney(savings.waste_eliminated.value)}</SavingsValue>
          ) : savings.waste_eliminated.requires_multiple_uploads ? (
            <span className="text-sm font-medium text-amber-700">Upload more data to unlock</span>
          ) : (
            <MutedDash />
          )}
        </SavingsBucket>
        <SavingsBucket title="Stockouts" subtitle="Prevented">
          <SavingsValue>
            {savings.stockouts_prevented.count} days ({formatMoney(savings.stockouts_prevented.estimated_value)})
          </SavingsValue>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Prevented {savings.stockouts_prevented.count} stockout days — est.{" "}
            {formatMoney(savings.stockouts_prevented.estimated_value)} in lost revenue avoided
          </p>
        </SavingsBucket>
      </div>
    </div>
  );
}

function SavingsBucket({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-36 rounded-lg border border-border bg-white p-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xl font-semibold tracking-normal text-foreground">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SavingsValue({ children }: { children: React.ReactNode }) {
  return <p className="text-2xl font-semibold tracking-normal text-foreground">{children}</p>;
}

function DataQualityBanner({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="text-sm leading-6">{message}</p>
      </div>
      <Button asChild variant="outline" className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
        <Link href="/help/kroll-export">Download Kroll export guide →</Link>
      </Button>
    </div>
  );
}

function HealthScoreSection({ query }: { query: QueryState<HealthScoreResponse> }) {
  return (
    <SectionCard title="Inventory health score" description="Composite score across stock status, accuracy, and stockout reduction.">
      {query.isLoading ? <SectionSkeleton rows={4} /> : null}
      {query.isError ? <SectionError message={query.error?.message ?? "Unable to load health score."} /> : null}
      {query.data ? <HealthScoreContent healthScore={query.data} /> : null}
    </SectionCard>
  );
}

function HealthScoreContent({ healthScore }: { healthScore: HealthScoreResponse }) {
  const score = clampScore(healthScore.score);
  const color = scoreColor(score);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
      <div className="mx-auto h-56 w-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="72%" outerRadius="96%" data={[{ value: score }]} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={12} fill={color} background={{ fill: "#E5E7EB" }} />
            <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-4xl font-semibold">
              {score}
            </text>
            <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">
              /100
            </text>
          </RadialBarChart>
        </ResponsiveContainer>
        <p className="text-center text-sm font-medium text-muted-foreground">Inventory health score</p>
      </div>
      <div className="space-y-5">
        <MetricBar
          label="Stock Health"
          value={healthScore.breakdown.stock_health}
          max={40}
          tooltip="Percentage of drugs with green forecast status"
        />
        <MetricBar
          label="Forecast Accuracy"
          value={healthScore.breakdown.accuracy}
          max={30}
          tooltip="How closely AI forecasts matched actual dispensing"
        />
        <MetricBar
          label="Stockout Reduction"
          value={healthScore.breakdown.stockout_reduction}
          max={30}
          tooltip="Reduction in days with zero stock vs prior period"
        />
      </div>
    </div>
  );
}

function MetricBar({ label, value, max, tooltip }: { label: string; value: number; max: number; tooltip: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span title={tooltip}>
            <HelpCircle className="h-4 w-4 text-muted-foreground" aria-label={tooltip} />
          </span>
        </div>
        <span className="text-sm font-semibold text-foreground">
          {value}/{max} pts
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-pharma-teal" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TrendsSection({ query }: { query: QueryState<TrendsInsightsResponse> }) {
  const growing = useMemo(
    () => [...(query.data?.top_growing ?? [])].sort((a, b) => (b.growth_pct ?? -Infinity) - (a.growth_pct ?? -Infinity)),
    [query.data?.top_growing]
  );
  const declining = useMemo(
    () =>
      [...(query.data?.top_declining ?? [])].sort(
        (a, b) => (b.decline_pct ?? -Infinity) - (a.decline_pct ?? -Infinity)
      ),
    [query.data?.top_declining]
  );

  return (
    <SectionCard title="Demand trends" description="Drug-level movement and total dispensing volume across the selected period.">
      {query.isLoading ? <SectionSkeleton rows={6} /> : null}
      {query.isError ? <SectionError message={query.error?.message ?? "Unable to load demand trends."} /> : null}
      {query.data ? (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <TrendTable title="Top growing drugs" rows={growing} metric="growth" color="#0F766E" />
            <TrendTable title="Top declining drugs" rows={declining} metric="decline" color="#DC2626" />
          </div>
          <TotalVolumeChart rows={query.data.total_dispensing_trend} />
        </div>
      ) : null}
    </SectionCard>
  );
}

function TrendTable({
  title,
  rows,
  metric,
  color
}: {
  title: string;
  rows: DemandChange[];
  metric: "growth" | "decline";
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {metric === "growth" ? (
          <TrendingUp className="h-4 w-4 text-pharma-teal" aria-hidden="true" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-600" aria-hidden="true" />
        )}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No demand movement yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Drug</th>
                <th className="px-4 py-3 font-medium">{metric === "growth" ? "Growth %" : "Decline %"}</th>
                <th className="px-4 py-3 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.din}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{row.drug_name}</p>
                    <p className="text-xs text-muted-foreground">{row.din}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {formatPercent(metric === "growth" ? row.growth_pct : row.decline_pct)}
                  </td>
                  <td className="px-4 py-3">
                    <Sparkline values={row.weekly_trend} color={color} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const chartData = values.map((value, index) => ({ index, value }));
  return (
    <div className="h-12 w-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TotalVolumeChart({ rows }: { rows: WeeklyTotal[] }) {
  const chartData = rows.map((row) => ({
    week: new Date(`${row.week}T00:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
    total: row.total_quantity
  }));

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground">Total dispensing volume</h3>
      {chartData.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No dispensing volume available yet.</p>
      ) : (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 4, right: 16, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="total-volume-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0F766E" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#0F766E" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={44} />
              <Area type="monotone" dataKey="total" stroke="#0F766E" strokeWidth={2} fill="url(#total-volume-fill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function AccuracySection({ query }: { query: QueryState<AccuracyInsightsResponse> }) {
  const rows = useMemo(() => [...(query.data?.by_drug ?? [])].sort((a, b) => b.mape - a.mape), [query.data?.by_drug]);

  return (
    <SectionCard title="Forecast accuracy" description="How forecasts compared with actual dispensing.">
      {query.isLoading ? <SectionSkeleton rows={4} /> : null}
      {query.isError ? <SectionError message={query.error?.message ?? "Unable to load forecast accuracy."} /> : null}
      {query.data ? (
        query.data.overall_accuracy_pct === null ? (
          <EmptyState message="Not enough data yet — accuracy improves over time." />
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg bg-teal-50 p-5 ring-1 ring-teal-100">
              <p className="text-4xl font-semibold tracking-normal text-pharma-teal">
                {Math.round(query.data.overall_accuracy_pct)}% accuracy
              </p>
              <p className="mt-2 text-sm text-muted-foreground">of forecasts were within 20% of actual dispensing</p>
            </div>
            {rows.length === 0 ? <EmptyState message="Not enough data yet — accuracy improves over time." /> : <AccuracyTable rows={rows} />}
          </div>
        )
      ) : null}
    </SectionCard>
  );
}

function AccuracyTable({ rows }: { rows: AccuracyInsightsResponse["by_drug"] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Drug</th>
            <th className="px-4 py-3 font-medium">Forecasted</th>
            <th className="px-4 py-3 font-medium">Actual</th>
            <th className="px-4 py-3 font-medium">Accuracy</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const accuracy = clampScore(100 - row.mape);
            return (
              <tr key={row.din}>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{row.drug_name}</p>
                  <p className="text-xs text-muted-foreground">{row.din}</p>
                </td>
                <td className="px-4 py-3">{row.forecast_qty}</td>
                <td className="px-4 py-3">{row.actual_qty}</td>
                <td className="px-4 py-3">
                  <span className={cn("font-semibold", accuracyTone(row.mape))}>{accuracy}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function accuracyTone(mape: number) {
  if (mape < 20) {
    return "text-green-700";
  }
  if (mape < 40) {
    return "text-amber-700";
  }
  return "text-red-700";
}

function SectionError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{message}</p>;
}

function MutedDash() {
  return <span className="text-sm text-muted-foreground">-</span>;
}

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3" aria-label="Loading insights section">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

function SavingsSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading savings insights">
      <div className="h-36 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
