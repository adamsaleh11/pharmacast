"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { FileUp, Loader2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCsvUpload } from "@/hooks/use-csv-upload";
import { cn } from "@/lib/utils";

interface CsvUploadZoneProps {
  locationId: string | null;
  onSuccess?: () => void;
}

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function CsvUploadZone({ locationId, onSuccess }: CsvUploadZoneProps) {
  const { state, error, filename, summary, startUpload, reset } = useCsvUpload(locationId);
  const [isDragging, setIsDragging] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    const callback = onSuccessRef.current;
    if (state === "success" && summary && callback && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      const timer = setTimeout(() => {
        callback();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state, summary]);

  const validateAndUpload = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        alert("Please select a valid .csv file.");
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`File size exceeds the ${MAX_FILE_SIZE_MB}MB limit.`);
        return;
      }
      startUpload(file);
    },
    [startUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) validateAndUpload(file);
    },
    [validateAndUpload]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndUpload(file);
    },
    [validateAndUpload]
  );

  if (state === "idle") {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors",
          isDragging ? "border-pharma-teal bg-teal-50" : "border-slate-300 bg-slate-50"
        )}
      >
        <FileUp className="h-10 w-10 text-slate-400" />
        <h3 className="mt-4 text-lg font-semibold text-slate-900">Upload dispensing history</h3>
        <p className="mt-1 text-sm text-slate-500">
          Drag and drop your Kroll export or click to browse
        </p>
        <p className="mt-2 text-xs text-slate-400">CSV files only, max {MAX_FILE_SIZE_MB}MB</p>
        <label className="mt-6 cursor-pointer">
          <span className="inline-flex h-10 items-center justify-center rounded-md bg-pharma-teal px-4 py-2 text-sm font-medium text-white shadow hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2">
            Select file
          </span>
          <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
        </label>
      </div>
    );
  }

  if (state === "uploading") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-10 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-pharma-teal" />
        <h3 className="mt-4 text-lg font-semibold">Uploading {filename}...</h3>
        <p className="mt-1 text-sm text-slate-500">Please do not close this tab.</p>
        <div className="mt-6 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
          <div className="h-full animate-pulse bg-pharma-teal" style={{ width: "100%" }} />
        </div>
      </div>
    );
  }

  if (state === "processing") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-10 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-pharma-teal" />
        <h3 className="mt-4 text-lg font-semibold">Validating and importing...</h3>
        <p className="mt-2 text-sm text-slate-500 italic">
          &quot;We are validating rows and cross-referencing Health Canada DINs to ensure forecasting
          accuracy.&quot;
        </p>
        <p className="mt-4 text-xs text-slate-400">This usually takes less than a minute.</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900">Upload failed</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <div className="mt-4 flex gap-3">
              <Button size="sm" variant="outline" onClick={reset}>
                Try again
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <a href="/help/kroll-export" target="_blank" rel="noopener noreferrer">
                  See Kroll export guide
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === "success" && summary) {
    return (
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-teal-900">Upload complete</h3>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-teal-700 uppercase tracking-wider font-medium">Rows</p>
                <p className="text-lg font-bold text-teal-900">{summary.total_rows}</p>
              </div>
              <div>
                <p className="text-xs text-teal-700 uppercase tracking-wider font-medium">Drugs</p>
                <p className="text-lg font-bold text-teal-900">{summary.unique_dins}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded bg-white/50 p-2 text-xs text-teal-800">
              <Info className="h-3.5 w-3.5" />
              <span>
                Date range: {summary.date_range_start} to {summary.date_range_end}
              </span>
            </div>
            {summary.warnings?.length > 0 && (
              <div className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800 border border-amber-100">
                <p className="font-semibold mb-1">Import Warnings:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {summary.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-teal-700">
                <CheckCircle2 className="h-3 w-3" />
                Redirecting to dashboard...
              </div>
              {onSuccess && (
                <Button size="sm" variant="teal" onClick={onSuccess}>
                  Continue to dashboard
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
