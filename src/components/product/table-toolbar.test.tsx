import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TableToolbar } from "./table-toolbar";

describe("TableToolbar", () => {
  it("supports controlled search input without dropping the existing action button", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    render(
      <TableToolbar
        searchPlaceholder="Search DIN or drug"
        actionLabel="Export review"
        searchValue="ator"
        onSearchChange={onSearchChange}
      />
    );

    const search = screen.getByRole("searchbox", { name: "Search DIN or drug" });

    expect(search).toHaveValue("ator");
    expect(screen.getByRole("button", { name: "Export review" })).toBeInTheDocument();

    await user.type(search, "v");

    expect(onSearchChange).toHaveBeenCalledWith("atorv");
  });
});
