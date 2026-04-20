import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CsvUploadZone } from "./csv-upload-zone";
import { useCsvUpload } from "@/hooks/use-csv-upload";

vi.mock("@/hooks/use-csv-upload", () => ({
  useCsvUpload: vi.fn()
}));

const mockUseCsvUpload = vi.mocked(useCsvUpload);

describe("CsvUploadZone", () => {
  const locationId = "location-123";

  beforeEach(() => {
    mockUseCsvUpload.mockReset();
  });

  it("renders idle state by default", () => {
    mockUseCsvUpload.mockReturnValue({
      state: "idle",
      error: null,
      filename: null,
      summary: null,
      startUpload: vi.fn(),
      reset: vi.fn()
    } as any);

    render(<CsvUploadZone locationId={locationId} />);

    expect(screen.getByText(/upload dispensing history/i)).toBeInTheDocument();
    expect(screen.getByText(/select file/i)).toBeInTheDocument();
  });

  it("calls startUpload when a file is selected", async () => {
    const startUpload = vi.fn();
    mockUseCsvUpload.mockReturnValue({
      state: "idle",
      error: null,
      filename: null,
      summary: null,
      startUpload,
      reset: vi.fn()
    } as any);

    render(<CsvUploadZone locationId={locationId} />);

    const file = new File(["foo,bar"], "data.csv", { type: "text/csv" });
    const input = screen.getByLabelText(/select file/i, { selector: "input" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(startUpload).toHaveBeenCalledWith(file);
  });

  it("shows processing state with trust-building message", () => {
    mockUseCsvUpload.mockReturnValue({
      state: "processing",
      error: null,
      filename: "data.csv",
      summary: null,
      startUpload: vi.fn(),
      reset: vi.fn()
    } as any);

    render(<CsvUploadZone locationId={locationId} />);

    expect(screen.getByText(/validating and importing/i)).toBeInTheDocument();
    expect(
      screen.getByText(/We are validating rows and cross-referencing Health Canada DINs/i)
    ).toBeInTheDocument();
  });

  it("shows success state with summary and update reassurance", () => {
    mockUseCsvUpload.mockReturnValue({
      state: "success",
      error: null,
      filename: "data.csv",
      summary: {
        total_rows: 100,
        unique_dins: 20,
        date_range_start: "2023-01-01",
        date_range_end: "2023-01-31",
        warnings: []
      },
      startUpload: vi.fn(),
      reset: vi.fn()
    } as any);

    render(<CsvUploadZone locationId={locationId} />);

    expect(screen.getByText(/upload complete/i)).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText(/data updated safely/i)).toBeInTheDocument();
  });

  it("shows error state with Kroll export guide link", () => {
    const reset = vi.fn();
    mockUseCsvUpload.mockReturnValue({
      state: "error",
      error: "Invalid file format",
      filename: "data.csv",
      summary: null,
      startUpload: vi.fn(),
      reset
    } as any);

    render(<CsvUploadZone locationId={locationId} />);

    expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
    expect(screen.getByText("Invalid file format")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see kroll export guide/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalled();
  });
});
