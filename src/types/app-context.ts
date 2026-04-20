export type AppUser = {
  id: string;
  email: string;
  role: "owner" | "admin" | "pharmacist" | "staff";
};

export type AppOrganization = {
  id: string;
  name: string;
};

export type AppLocation = {
  id: string;
  name: string;
  address?: string;
};

export type AppContextValue = {
  authReady: boolean;
  user: AppUser | null;
  organization: AppOrganization | null;
  locations: AppLocation[];
  currentLocation: AppLocation | null;
  setCurrentLocation: (location: AppLocation | null) => void;
  authError: string | null;
};
