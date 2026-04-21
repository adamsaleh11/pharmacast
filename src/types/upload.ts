export type CsvUploadStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "ERROR";

export type BacktestStatus = "PASS" | "LOW_CONFIDENCE" | "FAIL" | "ERROR";

export type UploadBacktestSummary = {
  status: BacktestStatus;
  model_version: string;
  mae: number | null;
  wape: number | null;
  interval_coverage: number | null;
  anomaly_count: number | null;
  beats_last_7_day_avg: boolean | null;
  beats_last_14_day_avg: boolean | null;
  baseline_last_7_day_avg_mae: number | null;
  baseline_last_14_day_avg_mae: number | null;
  rows_evaluated: number | null;
  din_count: number | null;
  generated_at: string;
  error_message: string | null;
  artifact_path: string | null;
};

export type ValidationSummary = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  unique_dins: number;
  date_range_start: string | null;
  date_range_end: string | null;
  warnings: string[];
  backtest?: UploadBacktestSummary | null;
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
  validationSummary: string | ValidationSummary | null;
  uploadedAt: string;
};
