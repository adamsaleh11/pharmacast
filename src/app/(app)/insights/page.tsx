import { Activity, BellRing, LineChart } from "lucide-react";
import { AppPageHeader } from "@/components/product/app-page-header";
import { SectionCard } from "@/components/product/section-card";
import { StatCard } from "@/components/product/stat-card";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Insights"
        description="Review inventory trends, reorder patterns, and alert readiness once forecasting data is available."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Demand movement" value="Pending" detail="Requires forecast data" icon={LineChart} tone="teal" />
        <StatCard title="Alert rules" value="3" detail="Critical, amber, digest" icon={BellRing} tone="amber" />
        <StatCard title="Operational signal" value="Drug-level" detail="No patient data displayed" icon={Activity} tone="green" />
      </div>
      <SectionCard title="Trend placeholders" description="Evidence-based savings and trend calculations are not implemented in this foundation.">
        <div className="grid gap-3 lg:grid-cols-3">
          {["Fast movers", "Slow movers", "Supply volatility"].map((title) => (
            <div key={title} className="rounded-lg border border-border bg-white p-4">
              <h3 className="font-medium">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">Future aggregate pharmacy trend data will render here.</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
