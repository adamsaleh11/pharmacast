"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentAuthUser, ApiError } from "@/lib/api/auth";
import { getPublicEnv } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";
import type { AppContextValue, AppLocation, AppOrganization, AppUser } from "@/types/app-context";

const CURRENT_LOCATION_STORAGE_KEY = "pharmacast.currentLocationId";

const placeholderContext: AppContextValue = {
  authReady: true,
  user: null,
  organization: null,
  locations: [],
  currentLocation: null,
  setCurrentLocation: () => undefined,
  authError: null
};

const AppContext = createContext<AppContextValue>(placeholderContext);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [organization, setOrganization] = useState<AppOrganization | null>(null);
  const [locations, setLocations] = useState<AppLocation[]>([]);
  const [currentLocation, setCurrentLocationState] = useState<AppLocation | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const setCurrentLocation = useCallback((location: AppLocation | null) => {
    setCurrentLocationState(location);

    if (typeof window === "undefined") {
      return;
    }

    if (location) {
      window.localStorage.setItem(CURRENT_LOCATION_STORAGE_KEY, location.id);
      return;
    }

    window.localStorage.removeItem(CURRENT_LOCATION_STORAGE_KEY);
  }, []);

  useEffect(() => {
    const env = getPublicEnv();
    const supabase = createSupabaseBrowserClient();

    console.info("[PharmaCast] Frontend env", {
      backendApiUrl: env.apiUrl || "not configured",
      supabaseUrl: env.supabaseUrl || "not configured",
      hasSupabaseAnonKey: Boolean(env.supabaseAnonKey),
      missingKeys: env.missingKeys
    });

    if (!supabase) {
      Promise.resolve().then(() => {
        setAuthReady(true);
        setAuthError(`Supabase is not configured. Missing: ${env.missingKeys.join(", ")}`);
      });
      return;
    }

    const authClient = supabase;
    let active = true;

    async function loadAuthenticatedContext(hasSession: boolean) {
      if (!active) {
        return;
      }

      if (!hasSession) {
        setUser(null);
        setOrganization(null);
        setLocations([]);
        setCurrentLocationState(null);
        setAuthError(null);
        setAuthReady(true);
        return;
      }

      setAuthReady(false);

      try {
        const accessToken = await getBackendAccessToken(authClient, "auth/me");
        if (!accessToken) {
          setUser(null);
          setOrganization(null);
          setLocations([]);
          setCurrentLocationState(null);
          setAuthError(null);
          return;
        }

        const response = await getCurrentAuthUser(accessToken);
        if (!active) {
          return;
        }

        const nextLocations = response.locations ?? [];
        const storedLocationId =
          typeof window === "undefined"
            ? null
            : window.localStorage.getItem(CURRENT_LOCATION_STORAGE_KEY);
        const nextCurrentLocation =
          nextLocations.find((location) => location.id === storedLocationId) ?? nextLocations[0] ?? null;

        setUser({
          id: response.id,
          email: response.email,
          role: response.role
        });
        setOrganization({
          id: response.organization_id,
          name: "Organization"
        });
        setLocations(nextLocations);
        setCurrentLocationState(nextCurrentLocation);
        setAuthError(null);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          const { data } = await authClient.auth.refreshSession();
          const retryToken = data.session?.access_token;

          if (retryToken) {
            try {
              const response = await getCurrentAuthUser(retryToken);
              if (!active) {
                return;
              }

              const nextLocations = response.locations ?? [];
              const storedLocationId =
                typeof window === "undefined"
                  ? null
                  : window.localStorage.getItem(CURRENT_LOCATION_STORAGE_KEY);
              const nextCurrentLocation =
                nextLocations.find((location) => location.id === storedLocationId) ?? nextLocations[0] ?? null;

              setUser({
                id: response.id,
                email: response.email,
                role: response.role
              });
              setOrganization({
                id: response.organization_id,
                name: "Organization"
              });
              setLocations(nextLocations);
              setCurrentLocationState(nextCurrentLocation);
              setAuthError(null);
              return;
            } catch (retryError) {
              error = retryError;
            }
          }
        }

        setUser(null);
        setOrganization(null);
        setLocations([]);
        setCurrentLocationState(null);

        if (error instanceof ApiError && error.code === "USER_PROFILE_NOT_BOOTSTRAPPED") {
          setAuthError("USER_PROFILE_NOT_BOOTSTRAPPED");
        } else if (error instanceof ApiError && error.status === 401) {
          setAuthError(null);
        } else {
          setAuthError(error instanceof Error ? error.message : "Unable to load authenticated user.");
        }
      } finally {
        if (active) {
          setAuthReady(true);
        }
      }
    }

    authClient.auth.getSession().then(({ data }) => {
      void loadAuthenticatedContext(Boolean(data.session));
    });

    const {
      data: { subscription }
    } = authClient.auth.onAuthStateChange((_event, session) => {
      void loadAuthenticatedContext(Boolean(session));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      authReady,
      user,
      organization,
      locations,
      currentLocation,
      setCurrentLocation,
      authError
    }),
    [authError, authReady, currentLocation, locations, organization, setCurrentLocation, user]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  return useContext(AppContext);
}
