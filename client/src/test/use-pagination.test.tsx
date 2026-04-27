/* Verify local pagination slices long UI collections so cards and rows can stay inside fixed dashboard panels. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePagination } from "../hooks/use-pagination";

function PaginationHarness() {
  const { page, totalPages, paginatedItems } = usePagination(["one", "two", "three", "four", "five"], 2);

  return (
    <div>
      <span>Page {page}</span>
      <span>Total {totalPages}</span>
      {paginatedItems.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  );
}

describe("usePagination", () => {
  it("returns the first bounded page and total page count", () => {
    render(<PaginationHarness />);

    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByText("Total 3")).toBeInTheDocument();
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
    expect(screen.queryByText("three")).not.toBeInTheDocument();
  });
});
