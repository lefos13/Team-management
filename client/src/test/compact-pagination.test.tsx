/* Verify high page counts render with a compact page window between arrow controls. */
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompactPagination } from "../components/CompactPagination";

describe("CompactPagination", () => {
  it("limits page buttons to three and marks hidden ranges with ellipses", () => {
    render(
      <MantineProvider>
        <CompactPagination total={100} value={50} onChange={vi.fn()} />
      </MantineProvider>,
    );

    expect(screen.getByRole("button", { name: "49" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "50" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "51" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "100" })).not.toBeInTheDocument();
    expect(screen.getAllByText("...")).toHaveLength(2);
  });
});
