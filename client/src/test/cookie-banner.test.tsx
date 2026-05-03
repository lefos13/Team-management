/* Verify the essential-only cookie notice appears once and stores the visitor acknowledgement. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { CookieBanner, cookiePreferenceStorageKey } from "../components/CookieBanner";

describe("CookieBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows until essential cookies are acknowledged", async () => {
    render(
      <MantineProvider>
        <MemoryRouter>
          <CookieBanner />
        </MemoryRouter>
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("region", { name: /cookie notice/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /accept essential cookies/i }));

    expect(window.localStorage.getItem(cookiePreferenceStorageKey)).toBe("true");
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: /cookie notice/i })).not.toBeInTheDocument();
    });
  });

  it("stays hidden after acknowledgement", async () => {
    window.localStorage.setItem(cookiePreferenceStorageKey, "true");

    render(
      <MantineProvider>
        <MemoryRouter>
          <CookieBanner />
        </MemoryRouter>
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: /cookie notice/i })).not.toBeInTheDocument();
    });
  });
});
