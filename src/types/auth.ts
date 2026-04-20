import type { AppLocation } from "@/types/app-context";

export type AuthMeResponse = {
  id: string;
  email: string;
  role: "owner" | "admin" | "pharmacist" | "staff";
  organization_id: string;
  locations: AppLocation[];
};

export type SignupBootstrapMetadata = {
  organization_name: string;
  location_name: string;
  location_address: string;
};

export type AuthBootstrapResponse = {
  organization_id: string;
  location_id: string;
  user_id: string;
};
