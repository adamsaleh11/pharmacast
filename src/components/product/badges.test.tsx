import { render, screen } from "@testing-library/react";
import { ConfidenceBadge } from "./confidence-badge";
import { StatusBadge, type StatusBadgeValue } from "./status-badge";

describe("enum-backed product badges", () => {
  it("renders backend status values in readable labels", () => {
    const statuses: Array<[StatusBadgeValue, string]> = [
      ["ok", "OK"],
      ["amber", "Amber"],
      ["red", "Red"],
      ["processing", "Processing"],
      ["cancelled", "Cancelled"]
    ];

    render(
      <div>
        {statuses.map(([value]) => (
          <StatusBadge key={value} value={value} />
        ))}
      </div>
    );

    for (const [, label] of statuses) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders forecast confidence values in readable labels", () => {
    render(
      <div>
        <ConfidenceBadge value="low" />
        <ConfidenceBadge value="medium" />
        <ConfidenceBadge value="high" />
      </div>
    );

    expect(screen.getByText("Low confidence")).toBeInTheDocument();
    expect(screen.getByText("Medium confidence")).toBeInTheDocument();
    expect(screen.getByText("High confidence")).toBeInTheDocument();
  });
});
