import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DrugIdentity } from "./drug-identity";
import type { DrugResponse } from "@/types/drug";

function drugMetadata(overrides: Partial<DrugResponse> = {}): DrugResponse {
  return {
    din: "02242903",
    name: "ATORVASTATIN",
    strength: "20 MG",
    form: "TABLET",
    therapeuticClass: "LIPID MODIFYING AGENTS",
    manufacturer: "APOTEX INC",
    status: "MARKETED",
    lastRefreshedAt: "2026-04-20T12:00:00Z",
    ...overrides
  };
}

describe("DrugIdentity", () => {
  it("shows fallback drug text and canonical DIN when metadata is unavailable", () => {
    render(<DrugIdentity din="12345" fallbackName="Atorvastatin 20 mg" metadata={null} />);

    expect(screen.getByText("Atorvastatin 20 mg")).toBeInTheDocument();
    expect(screen.getByText("00012345")).toBeInTheDocument();
  });

  it("uses enriched name and strength when metadata exists", () => {
    render(<DrugIdentity din="02242903" fallbackName="Atorvastatin 20 mg" metadata={drugMetadata()} />);

    expect(screen.getByText("ATORVASTATIN 20 MG")).toBeInTheDocument();
    expect(screen.getByText("02242903")).toBeInTheDocument();
  });

  it("does not append Unknown strength to the primary drug line", () => {
    render(
      <DrugIdentity
        din="02242903"
        fallbackName="Atorvastatin 20 mg"
        metadata={drugMetadata({ name: "Unknown Drug", strength: "Unknown" })}
      />
    );

    expect(screen.getByText("Unknown Drug")).toBeInTheDocument();
    expect(screen.queryByText("Unknown Drug Unknown")).not.toBeInTheDocument();
  });

  it("renders unverified and discontinued status badges", () => {
    const { rerender } = render(
      <DrugIdentity din="02242903" fallbackName="Atorvastatin 20 mg" metadata={drugMetadata({ status: "UNVERIFIED" })} />
    );

    expect(screen.getByText("Unverified DIN")).toBeInTheDocument();

    rerender(
      <DrugIdentity din="02242903" fallbackName="Atorvastatin 20 mg" metadata={drugMetadata({ status: "DORMANT" })} />
    );

    expect(screen.getByText("Discontinued")).toBeInTheDocument();
  });
});
