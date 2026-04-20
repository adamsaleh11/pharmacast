import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    replace: vi.fn()
  })
}));

describe("AppShell", () => {
  it("renders pharmacy navigation and auth-aware placeholders", () => {
    render(
      <AppShell>
        <h1>Dashboard</h1>
      </AppShell>
    );

    expect(screen.getAllByText("PharmaCast")[0]).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Dashboard/i })[0]).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
