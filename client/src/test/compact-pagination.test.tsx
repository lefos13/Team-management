/* Verify high page counts render with a compact page window between arrow controls. */
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompactPagination } from "../components/CompactPagination";

describe("CompactPagination", () => {
  it("hides distant page numbers while keeping nearby choices", () => {
    render(
      <MantineProvider>
        <CompactPagination total={20} value={10} onChange={vi.fn()} />
      </MantineProvider>,
    );

    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "11" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "6" })).not.toBeInTheDocument();
  });
});
