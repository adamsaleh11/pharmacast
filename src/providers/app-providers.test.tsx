import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "./app-providers";
import { useAppContext } from "./app-context";
import { getCurrentAuthUser } from "@/lib/api/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

vi.mock("@/lib/api/auth", () => ({
  getCurrentAuthUser: vi.fn()
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn()
}));

const mockGetCurrentAuthUser = vi.mocked(getCurrentAuthUser);
const mockCreateSupabaseBrowserClient = vi.mocked(createSupabaseBrowserClient);

function Consumer() {
  const context = useAppContext();
  return (
    <div>
      <span>{context.authReady ? "Auth ready" : "Auth loading"}</span>
      <span>{context.organization?.id ?? "No organization"}</span>
      <span>{context.currentLocation?.name ?? "No location"}</span>
    </div>
  );
}

describe("AppProviders", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockGetCurrentAuthUser.mockReset();
    mockCreateSupabaseBrowserClient.mockReset();
  });

  it("renders children and settles auth context without live credentials", async () => {
    mockCreateSupabaseBrowserClient.mockReturnValue(null);

    render(
      <AppProviders>
        <Consumer />
      </AppProviders>
    );

    await waitFor(() => expect(screen.getByText("Auth ready")).toBeInTheDocument());
    expect(screen.getByText("No organization")).toBeInTheDocument();
  });

  it("initializes app context from Supabase session and backend auth profile", async () => {
    window.localStorage.setItem("pharmacast.currentLocationId", "location-2");
    mockCreateSupabaseBrowserClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: "access-token"
            }
          }
        }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: {
            subscription: {
              unsubscribe: vi.fn()
            }
          }
        })
      }
    } as never);
    mockGetCurrentAuthUser.mockResolvedValue({
      id: "user-1",
      email: "owner@example.ca",
      role: "owner",
      organization_id: "organization-1",
      locations: [
        { id: "location-1", name: "Main" },
        { id: "location-2", name: "Bank Street" }
      ]
    });

    render(
      <AppProviders>
        <Consumer />
      </AppProviders>
    );

    await waitFor(() => expect(screen.getByText("organization-1")).toBeInTheDocument());
    expect(screen.getByText("Bank Street")).toBeInTheDocument();
    expect(mockGetCurrentAuthUser).toHaveBeenCalledWith("access-token");
  });
});
