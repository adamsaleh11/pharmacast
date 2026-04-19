import { render, screen } from "@testing-library/react";
import { AppProviders } from "./app-providers";
import { useAppContext } from "./app-context";

function Consumer() {
  const context = useAppContext();
  return <div>{context.organization?.name}</div>;
}

describe("AppProviders", () => {
  it("renders children with placeholder application context and no live credentials", () => {
    render(
      <AppProviders>
        <Consumer />
      </AppProviders>
    );

    expect(screen.getByText("Ottawa Independent Pharmacy")).toBeInTheDocument();
  });
});
