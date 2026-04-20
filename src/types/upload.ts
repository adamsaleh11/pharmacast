export type CsvUploadStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "ERROR";

export type ValidationSummary = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  unique_dins: number;
  date_range_start: string | null;
  date_range_end: string | null;
  warnings: string[];
};

export type CreateUploadResponse = {
  uploadId: string;
  status: CsvUploadStatus;
};

export type UploadResponse = {
  uploadId: string;
  filename: string;
  status: CsvUploadStatus;
  rowCount: number | null;
  drugCount: number | null;
  validationSummary: string | null; // Note: Backend returns stringified JSON
  uploadedAt: string;
};
