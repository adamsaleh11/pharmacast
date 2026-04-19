import { Building2, MapPinned, TrendingUp } from "lucide-react";
import { AppPageHeader } from "@/components/product/app-page-header";
import { SectionCard } from "@/components/product/section-card";
import { StatCard } from "@/components/product/stat-card";
import { StatusBadge } from "@/components/product/status-badge";

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Overview"
        description="A network-level view for comparing locations and inventory signals once Spring Boot APIs are connected."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Locations" value="2" detail="Multi-location ready" icon={MapPinned} tone="teal" />
        <StatCard title="Organization" value="Ottawa" detail="Placeholder tenant scope" icon={Building2} tone="navy" />
        <StatCard title="Trend coverage" value="API-ready" detail="No live calculations yet" icon={TrendingUp} tone="green" />
      </div>
      <SectionCard title="Location summary" description="Static scaffold for future aggregated, drug-level demand signals.">
        <div className="grid gap-3 md:grid-cols-2">
          {["Bank Street", "Centretown"].map((location, index) => (
            <div key={location} className="rounded-lg border border-border bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{location}</h3>
                <StatusBadge value={index === 0 ? "amber" : "ok"} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Forecast and reorder summaries will appear here after integration.</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
