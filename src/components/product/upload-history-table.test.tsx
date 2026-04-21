import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UploadHistoryTable } from "./upload-history-table";
import { listUploads } from "@/lib/api/upload";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";

vi.mock("@/lib/api/upload", () => ({
  listUploads: vi.fn()
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    channel: vi.fn(),
    removeChannel: vi.fn()
  }))
}));

vi.mock("@/lib/supabase/session", () => ({
  getBackendAccessToken: vi.fn(async () => "access-token")
}));

const mockListUploads = vi.mocked(listUploads);
vi.mocked(createSupabaseBrowserClient);
vi.mocked(getBackendAccessToken);

describe("UploadHistoryTable", () => {
  it("renders explicit backtest model metadata from the upload list", async () => {
    mockListUploads.mockResolvedValue([
      {
        uploadId: "upload-1",
        filename: "dispensing.csv",
        status: "SUCCESS",
        rowCount: 120,
        drugCount: 8,
        backtestModelVersion: "2026.04",
        backtestModelPathCounts: {
          prophet: 6,
          xgboost_residual_interval: 72
        },
        validationSummary: null,
        uploadedAt: "2026-04-21T05:00:00Z"
      }
    ]);

    render(<UploadHistoryTable locationId="location-1" />);

    expect(await screen.findByText("dispensing.csv")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Verification model 2026.04")).toBeInTheDocument());
    expect(screen.getByText(/Prophet: 6/)).toBeInTheDocument();
    expect(screen.getByText(/XGBoost residual interval: 72/)).toBeInTheDocument();
  });
});
