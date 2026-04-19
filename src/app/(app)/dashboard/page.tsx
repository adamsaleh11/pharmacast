import { AlertTriangle, Boxes, CalendarClock, Upload } from "lucide-react";
import { AppPageHeader } from "@/components/product/app-page-header";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/product/section-card";
import { StatCard } from "@/components/product/stat-card";
import { StatusBadge } from "@/components/product/status-badge";
import { ConfidenceBadge } from "@/components/product/confidence-badge";
import { TableToolbar } from "@/components/product/table-toolbar";

const reorderRows = [
  { din: "02242903", drug: "Atorvastatin 20 mg", status: "red", supply: "2.1 days", confidence: "high" },
  { din: "02471477", drug: "Metformin 500 mg", status: "amber", supply: "5.4 days", confidence: "medium" },
  { din: "02247618", drug: "Amlodipine 5 mg", status: "ok", supply: "14.8 days", confidence: "high" }
] as const;

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Dashboard"
        description="Monitor demand signals, reorder risk, and forecast readiness for the selected pharmacy location."
        actions={
          <>
            <Button variant="outline" type="button">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload CSV
            </Button>
            <Button variant="teal" type="button">
              Generate forecast
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Critical reorder risks" value="3" detail="Needs review today" icon={AlertTriangle} tone="red" />
        <StatCard title="Amber watchlist" value="8" detail="Under 7 days supply" icon={CalendarClock} tone="amber" />
        <StatCard title="Active DINs" value="142" detail="CSV-ready inventory scope" icon={Boxes} tone="teal" />
        <StatCard title="Forecast horizon" value="30d" detail="On-demand generation" icon={CalendarClock} tone="green" />
      </div>

      <SectionCard title="Reorder risk preview" description="Static API-ready scaffold for future Spring Boot forecast data.">
        <div className="space-y-4">
          <TableToolbar searchPlaceholder="Search DIN or drug" actionLabel="Export review" />
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">DIN</th>
                  <th className="px-4 py-3 font-medium">Drug</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
                  <th className="px-4 py-3 font-medium">Days supply</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {reorderRows.map((row) => (
                  <tr key={row.din}>
                    <td className="px-4 py-3 font-mono text-xs">{row.din}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{row.drug}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={row.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.supply}</td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge value={row.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
