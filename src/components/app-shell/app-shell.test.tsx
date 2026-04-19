import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard"
}));

describe("AppShell", () => {
  it("renders pharmacy navigation and operational placeholders", () => {
    render(
      <AppShell>
        <h1>Dashboard</h1>
      </AppShell>
    );

    expect(screen.getAllByText("PharmaForecast")[0]).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Dashboard/i })[0]).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Ottawa Independent Pharmacy")).toBeInTheDocument();
    expect(screen.getByText("Bank Street")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });
});
