import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MantineProvider, localStorageColorSchemeManager } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "../components/ThemeToggle";

describe("ThemeToggle", () => {
  const storageKey = "mantine-color-scheme-value";

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-mantine-color-scheme");
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-mantine-color-scheme");
  });

  it("renders with aria-label and moon icon initially in light mode", () => {
    const colorSchemeManager = localStorageColorSchemeManager({ key: storageKey });

    const { container } = render(
      <MantineProvider defaultColorScheme="light" colorSchemeManager={colorSchemeManager}>
        <ThemeToggle />
      </MantineProvider>,
    );

    const toggleButton = screen.getByRole("button", { name: "Toggle color scheme" });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute("aria-label", "Toggle color scheme");

    // In light mode, IconMoon is rendered
    expect(container.querySelector(".tabler-icon-moon")).toBeInTheDocument();
    expect(container.querySelector(".tabler-icon-sun")).not.toBeInTheDocument();
  });

  it("toggles color scheme to dark and persists to localStorage and documentElement", async () => {
    const user = userEvent.setup();
    const colorSchemeManager = localStorageColorSchemeManager({ key: storageKey });

    const { container } = render(
      <MantineProvider defaultColorScheme="light" colorSchemeManager={colorSchemeManager}>
        <ThemeToggle />
      </MantineProvider>,
    );

    const toggleButton = screen.getByRole("button", { name: "Toggle color scheme" });

    // Initial state: light
    expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("light");

    // Click to toggle to dark
    await user.click(toggleButton);

    expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("dark");
    expect(window.localStorage.getItem(storageKey)).toBe("dark");
    expect(container.querySelector(".tabler-icon-sun")).toBeInTheDocument();
    expect(container.querySelector(".tabler-icon-moon")).not.toBeInTheDocument();

    // Click again to toggle back to light
    await user.click(toggleButton);

    expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("light");
    expect(window.localStorage.getItem(storageKey)).toBe("light");
    expect(container.querySelector(".tabler-icon-moon")).toBeInTheDocument();
    expect(container.querySelector(".tabler-icon-sun")).not.toBeInTheDocument();
  });
});
