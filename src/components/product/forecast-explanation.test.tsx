import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForecastExplanation } from "./forecast-explanation";

afterEach(() => {
  vi.useRealTimers();
});

describe("ForecastExplanation", () => {
  it("renders the explanation text and collapse action", () => {
    render(
      <ForecastExplanation
        title="Metformin 500mg — Forecast explanation"
        explanation="Current stock is sufficient for 6 days."
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    expect(screen.getByText("Metformin 500mg — Forecast explanation")).toBeInTheDocument();
    expect(screen.getByText("Current stock is sufficient for 6 days.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse" })).toBeInTheDocument();
  });

  it("shows the delayed loading note after fifteen seconds", () => {
    vi.useFakeTimers();

    render(
      <ForecastExplanation
        title="Metformin 500mg — Forecast explanation"
        explanation={null}
        isLoading={true}
        isError={false}
        onRetry={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    expect(screen.getByText("Analyzing your dispensing patterns...")).toBeInTheDocument();
    expect(screen.queryByText("Taking longer than usual… still working")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(screen.getByText("Taking longer than usual… still working")).toBeInTheDocument();
  });

  it("renders the retry action when explanation generation fails", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <ForecastExplanation
        title="Metformin 500mg — Forecast explanation"
        explanation={null}
        isLoading={false}
        isError={true}
        onRetry={onRetry}
        onCollapse={vi.fn()}
      />
    );

    expect(screen.getByText("Explanation unavailable — try again")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
