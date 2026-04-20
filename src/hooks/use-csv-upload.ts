import { useState, useCallback, useEffect } from "react";
import { uploadCsv, getUploadDetail } from "@/lib/api/upload";
import { getBackendAccessToken } from "@/lib/supabase/session";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ValidationSummary, CsvUploadStatus } from "@/types/upload";

export type UploadState = "idle" | "uploading" | "processing" | "success" | "error";

export function useCsvUpload(locationId: string | null) {
  const [state, setState] = useState<UploadState>("idle");
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const handleTerminalState = useCallback((status: CsvUploadStatus, summaryStr: string | null) => {
    if (status === "SUCCESS") {
      setState("success");
      if (summaryStr) {
        try {
          setSummary(JSON.parse(summaryStr));
        } catch (e) {
          console.error("Failed to parse validation summary", e);
        }
      }
    } else if (status === "ERROR") {
      setState("error");
      setError("The file contains validation errors. Please check the Kroll export guide.");
      if (summaryStr) {
        try {
          setSummary(JSON.parse(summaryStr));
        } catch (e) {
          console.error("Failed to parse validation summary", e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (state !== "processing" || !uploadId || !locationId) return;

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`location:${locationId}`)
      .on("broadcast", { event: "upload_complete" }, ({ payload }) => {
        if (payload.uploadId === uploadId) {
          handleTerminalState(payload.status, payload.summary);
        }
      })
      .subscribe();

    const pollingInterval = setInterval(async () => {
      try {
        const accessToken = await getBackendAccessToken(supabase, "csv-polling");
        if (!accessToken) return;

        const detail = await getUploadDetail(locationId, uploadId, accessToken);
        if (detail.status === "SUCCESS" || detail.status === "ERROR") {
          handleTerminalState(detail.status, detail.validationSummary);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [state, uploadId, locationId, handleTerminalState]);

  useEffect(() => {
    if (state !== "uploading") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [state]);

  const startUpload = useCallback(
    async (file: File) => {
      if (!locationId) {
        setError("Missing location identification. Please complete the previous steps.");
        setState("error");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Supabase client not initialized.");
        setState("error");
        return;
      }

      setFilename(file.name);
      setState("uploading");
      setError(null);

      try {
        const accessToken = await getBackendAccessToken(supabase, "csv-upload");
        if (!accessToken) {
          throw new Error("You must be signed in to upload data.");
        }

        const response = await uploadCsv(locationId, file, accessToken);
        setUploadId(response.uploadId);
        setState("processing");
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred during upload.");
        setState("error");
      }
    },
    [locationId]
  );

  const reset = useCallback(() => {
    setState("idle");
    setUploadId(null);
    setError(null);
    setSummary(null);
    setFilename(null);
  }, []);

  return {
    state,
    uploadId,
    error,
    summary,
    filename,
    startUpload,
    setState,
    setSummary,
    setError,
    reset
  };
}
