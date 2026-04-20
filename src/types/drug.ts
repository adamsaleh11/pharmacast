export type DrugStatus =
  | "ACTIVE"
  | "APPROVED"
  | "MARKETED"
  | "DORMANT"
  | "CANCELLED"
  | "UNVERIFIED"
  | "UNKNOWN";

export type DrugResponse = {
  din: string;
  name: string;
  strength: string;
  form: string;
  therapeuticClass: string;
  manufacturer: string;
  status: DrugStatus;
  lastRefreshedAt: string;
};
