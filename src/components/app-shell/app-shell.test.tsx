import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

vi.mock("@/providers/app-context", () => ({
  useAppContext: () => ({
    authError: null,
    authReady: true,
    user: { id: "user-1", email: "owner@example.com", role: "owner" },
    organization: { id: "org-1", name: "Organization" },
    currentLocation: { id: "location-1", name: "Location" }
  })
}));

describe("AppShell", () => {
  it("renders pharmacy navigation and auth-aware placeholders", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AppShell>
          <h1>Dashboard</h1>
        </AppShell>
      </QueryClientProvider>
    );

    expect(screen.getAllByText("PharmaCast")[0]).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Dashboard/i })[0]).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
