"use client";

import { createContext, useContext } from "react";
import type { AppContextValue } from "@/types/app-context";

const placeholderContext: AppContextValue = {
  authReady: false,
  user: null,
  organization: {
    id: "placeholder-organization",
    name: "Ottawa Independent Pharmacy"
  },
  location: {
    id: "placeholder-location",
    name: "Bank Street"
  }
};

const AppContext = createContext<AppContextValue>(placeholderContext);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  return <AppContext.Provider value={placeholderContext}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  return useContext(AppContext);
}
