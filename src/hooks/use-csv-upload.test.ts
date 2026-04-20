import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCsvUpload } from "./use-csv-upload";
import { uploadCsv, getUploadDetail } from "@/lib/api/upload";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";

vi.mock("@/lib/api/upload", () => ({
  uploadCsv: vi.fn(),
  getUploadDetail: vi.fn()
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn()
}));

vi.mock("@/lib/supabase/session", () => ({
  getBackendAccessToken: vi.fn()
}));

const mockUploadCsv = vi.mocked(uploadCsv);
const mockGetUploadDetail = vi.mocked(getUploadDetail);
const mockCreateSupabaseBrowserClient = vi.mocked(createSupabaseBrowserClient);
const mockGetBackendAccessToken = vi.mocked(getBackendAccessToken);

describe("useCsvUpload", () => {
  const locationId = "location-123";
  const mockFile = new File(["dummy,data"], "test.csv", { type: "text/csv" });

  const mockSupabase = {
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis()
    }),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn()
    }
  };

  beforeEach(() => {
    mockUploadCsv.mockReset();
    mockGetUploadDetail.mockReset();
    mockCreateSupabaseBrowserClient.mockReset();
    mockGetBackendAccessToken.mockReset();
    mockGetBackendAccessToken.mockResolvedValue("mock-token");
    mockCreateSupabaseBrowserClient.mockReturnValue(mockSupabase as any);
  });

  it("transitions from idle to uploading to processing", async () => {
    mockUploadCsv.mockResolvedValue({ uploadId: "upload-1", status: "PENDING" });

    const { result } = renderHook(() => useCsvUpload(locationId));

    expect(result.current.state).toBe("idle");

    await act(async () => {
      void result.current.startUpload(mockFile);
    });

    await waitFor(() => expect(result.current.state).toBe("processing"));
    expect(result.current.uploadId).toBe("upload-1");
  });

  it("handles upload failure", async () => {
    mockUploadCsv.mockRejectedValue(new Error("Network Error"));

    const { result } = renderHook(() => useCsvUpload(locationId));

    await act(async () => {
      void result.current.startUpload(mockFile);
    });

    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.error).toBe("Network Error");
  });

  it("polls for terminal state when Realtime is not triggered", async () => {
    vi.useFakeTimers();
    mockUploadCsv.mockResolvedValue({ uploadId: "upload-1", status: "PENDING" });
    
    // Default mock behavior for polling
    mockGetUploadDetail.mockResolvedValue({
      status: "PROCESSING",
      uploadId: "upload-1",
      filename: "test.csv",
      rowCount: null,
      drugCount: null,
      validationSummary: null,
      uploadedAt: new Date().toISOString()
    } as any);

    const { result } = renderHook(() => useCsvUpload(locationId));

    await act(async () => {
      void result.current.startUpload(mockFile);
    });

    // Move to processing
    await vi.runOnlyPendingTimersAsync();
    expect(result.current.state).toBe("processing");

    // Change mock to return success for next poll
    mockGetUploadDetail.mockResolvedValue({
      status: "SUCCESS",
      uploadId: "upload-1",
      filename: "test.csv",
      rowCount: 10,
      drugCount: 5,
      validationSummary: JSON.stringify({ total_rows: 10, unique_dins: 5 }),
      uploadedAt: new Date().toISOString()
    } as any);

    // Advance for poll
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await vi.runOnlyPendingTimersAsync();

    expect(result.current.state).toBe("success");
    expect(result.current.summary?.total_rows).toBe(10);
    
    vi.useRealTimers();
  });
});
