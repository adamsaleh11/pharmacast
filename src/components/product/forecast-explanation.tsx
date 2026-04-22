"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ForecastExplanationProps = {
  title: string;
  explanation: string | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onCollapse: () => void;
  className?: string;
};

export function ForecastExplanation({
  title,
  explanation,
  isLoading,
  isError,
  onRetry,
  onCollapse,
  className
}: ForecastExplanationProps) {
  const [showLongLoadingCopy, setShowLongLoadingCopy] = useState(false);
  const showLoadingState = isLoading || (!isError && !explanation);

  useEffect(() => {
    if (!showLoadingState) {
      const reset = window.setTimeout(() => setShowLongLoadingCopy(false), 0);
      return () => window.clearTimeout(reset);
    }

    const timeout = window.setTimeout(() => setShowLongLoadingCopy(true), 15_000);
    return () => window.clearTimeout(timeout);
  }, [showLoadingState]);

  return (
    <div
      className={cn(
        "w-full rounded-md border border-teal-100 border-l-4 border-l-teal-500 bg-teal-50 px-4 py-3 text-sm text-slate-800 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 min-h-5">
            {showLoadingState ? (
              <div className="space-y-1 text-sm text-slate-700" aria-live="polite">
                <div className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-700" aria-hidden="true" />
                  <span>Analyzing your dispensing patterns...</span>
                </div>
                {showLongLoadingCopy ? <div className="text-xs text-slate-600">Taking longer than usual… still working</div> : null}
              </div>
            ) : isError ? (
              <div className="space-y-3" aria-live="polite">
                <div className="font-medium text-red-700">Explanation unavailable — try again</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Retry
                  </Button>
                </div>
              </div>
            ) : explanation ? (
              <div className="select-text whitespace-pre-wrap leading-6 text-slate-800">{explanation}</div>
            ) : null}
          </div>
        </div>
        <Button type="button" size="sm" variant="ghost" className="shrink-0 text-teal-800 hover:bg-teal-100 hover:text-teal-900" onClick={onCollapse}>
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
          Collapse
        </Button>
      </div>
    </div>
  );
}
