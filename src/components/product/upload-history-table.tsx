"use client";

import { useEffect, useState } from "react";
import { listUploads } from "@/lib/api/upload";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";
import type { UploadResponse } from "@/types/upload";
import { Loader2, AlertCircle, CheckCircle2, Clock, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatBacktestPercent,
  getBacktestDisplay,
  getUploadValidationSummary
} from "@/lib/upload-summary";

interface UploadHistoryTableProps {
  locationId: string | null;
}

export function UploadHistoryTable({ locationId }: UploadHistoryTableProps) {
  const [uploads, setUploads] = useState<UploadResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchHistory() {
      if (!locationId) {
        if (isMounted) setIsLoading(false);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;

      try {
        const accessToken = await getBackendAccessToken(supabase, "list-uploads");
        if (!accessToken || !isMounted) return;

        const data = await listUploads(locationId, accessToken);
        if (!isMounted) return;
        setUploads(data);
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        setError("Failed to load upload history.");
        console.error(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [locationId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-pharma-teal" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-500">
        <FileText className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-sm">No uploads found for this location.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-left text-sm border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 font-semibold text-slate-700">Date Uploaded</th>
            <th className="px-4 py-3 font-semibold text-slate-700">Filename</th>
            <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
            <th className="px-4 py-3 font-semibold text-slate-700">Summary</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {uploads.map((upload) => {
            const summary = getUploadValidationSummary(upload);
            const backtest = summary?.backtest ?? null;
            const backtestDisplay = getBacktestDisplay(backtest);

            return (
              <tr key={upload.uploadId} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {new Date(upload.uploadedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short"
                  })}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{upload.filename}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={upload.status} />
                </td>
                <td className="px-4 py-3">
                  {summary ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex flex-wrap gap-3">
                        <span>
                          <span className="text-slate-400">Rows:</span>{" "}
                          <span className="font-medium text-slate-700">{summary.total_rows}</span>
                        </span>
                        <span>
                          <span className="text-slate-400">Drugs:</span>{" "}
                          <span className="font-medium text-slate-700">{summary.unique_dins}</span>
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={backtestDisplay.tone} className="gap-1">
                          {backtestDisplay.badgeLabel}
                        </Badge>
                        {backtest ? (
                          <span className="text-slate-500">
                            WAPE {formatBacktestPercent(backtest.wape)} · Coverage{" "}
                            {formatBacktestPercent(backtest.interval_coverage)}
                          </span>
                        ) : (
                          <span className="text-slate-400">{backtestDisplay.description}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "SUCCESS":
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Success
        </Badge>
      );
    case "ERROR":
      return (
        <Badge variant="danger" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>
      );
    case "PROCESSING":
      return (
        <Badge variant="warning" className="gap-1 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </Badge>
      );
    case "PENDING":
      return (
        <Badge variant="muted" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
