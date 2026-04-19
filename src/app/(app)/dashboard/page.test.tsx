import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";

describe("Dashboard route", () => {
  it("renders the product entry surface without requiring live API credentials", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText(/Monitor demand signals/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate forecast/i })).toBeInTheDocument();
    expect(screen.getByText("02242903")).toBeInTheDocument();
  });
});
