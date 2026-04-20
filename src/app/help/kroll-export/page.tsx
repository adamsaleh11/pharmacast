import { AppPageHeader } from "@/components/product/app-page-header";
import { SectionCard } from "@/components/product/section-card";
import { FileText, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function KrollExportGuidePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
      <Link href="/dashboard" className="mb-8 inline-flex items-center text-sm font-medium text-pharma-teal hover:underline">
        <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
        Back to dashboard
      </Link>

      <AppPageHeader
        title="Kroll CSV Export Guide"
        description="Follow these steps to generate the correct dispensing history file for PharmaForecast."
      />

      <div className="mt-8 space-y-8">
        <SectionCard title="Step 1: Open Dispensing Report" description="In your Kroll terminal, navigate to the Reports menu.">
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="flex gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-pharma-teal" />
              Go to <span className="font-semibold text-slate-900">Reports {">"} Dispensing {">"} Drug Utilization</span>.
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-pharma-teal" />
              Select the date range you wish to forecast (we recommend at least the last 12 months).
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="Step 2: Required Columns" description="PharmaForecast requires specific data points to generate accurate predictions.">
          <p className="mb-4 text-sm text-slate-600">Ensure the following fields are checked in your export selection:</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              "Dispensed Date",
              "DIN / PIN",
              "Quantity Dispensed",
              "Quantity On Hand",
              "Cost per Unit (Optional)",
              "Patient ID (Optional, scrubbed on upload)"
            ].map((col) => (
              <div key={col} className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm font-medium text-slate-700">
                <FileText className="h-4 w-4 text-slate-400" />
                {col}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Step 3: Export as CSV" description="Save the file in the correct format.">
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="flex gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-pharma-teal" />
              Click <span className="font-semibold text-slate-900">Export</span> and select <span className="font-semibold text-slate-900">CSV (Comma Separated)</span> as the format.
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-pharma-teal" />
              Save the file to your desktop for easy access during upload.
            </li>
          </ul>
        </SectionCard>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h3 className="text-sm font-semibold text-amber-900">Common Validation Issues</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
            <li>Date format should be YYYY-MM-DD or DD/MM/YYYY.</li>
            <li>DINs must be exactly 8 digits.</li>
            <li>Quantities must be positive numbers.</li>
          </ul>
        </div>

        <div className="flex justify-center">
          <Button asChild variant="teal" size="lg">
            <Link href="/onboarding?step=3">Return to upload</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
