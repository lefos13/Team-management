/* Integration tests for What's New changelog page, empty state, and AppShellLayout navigation. */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WhatsNewPage } from "../pages/WhatsNewPage";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { whatsNewEntries, type WhatsNewEntry } from "../data/whats-new";
import { formatDate } from "../lib/dates";

vi.mock("../hooks/use-auth", async () => {
  const actual = await vi.importActual("../hooks/use-auth");
  return {
    ...actual,
    getCurrentUser: vi.fn().mockResolvedValue({
      id: "user-1",
      email: "demo@team-management.local",
      name: "Demo User",
      role: "admin",
    }),
  };
});

describe("What's New Feature", () => {
  beforeEach(() => {
    // Default matchMedia to desktop so sidebar navbar is expanded
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("WhatsNewPage Component", () => {
    it("renders release cards with title, date, category badges, and highlights", () => {
      render(
        <MantineProvider>
          <WhatsNewPage />
        </MantineProvider>,
      );

      // Verify page title
      expect(screen.getByRole("heading", { level: 1, name: /what's new/i })).toBeInTheDocument();

      // Verify each default entry is rendered
      for (const entry of whatsNewEntries) {
        expect(screen.getByText(entry.title)).toBeInTheDocument();
        expect(screen.getByText(entry.summary)).toBeInTheDocument();
        expect(screen.getAllByText(formatDate(entry.date)).length).toBeGreaterThan(0);

        // Verify highlights
        for (const highlight of entry.highlights) {
          expect(screen.getByText(highlight)).toBeInTheDocument();
        }
      }

      // Verify category badges exist
      const featureBadges = screen.getAllByText("Feature");
      expect(featureBadges.length).toBeGreaterThan(0);
      const improvementBadges = screen.getAllByText("Improvement");
      expect(improvementBadges.length).toBeGreaterThan(0);
    });

    it("renders custom entries with fix category badge and version", () => {
      const customEntries: WhatsNewEntry[] = [
        {
          id: "custom-fix",
          date: "2026-09-01",
          version: "v1.4.1",
          title: "Resolved timezone drift in calendar export",
          summary: "Fixed an issue where exported .ics events were offset by UTC variance.",
          category: "fix",
          highlights: ["Accurate UTC parsing", "Clean multi-calendar sync"],
        },
      ];

      render(
        <MantineProvider>
          <WhatsNewPage entries={customEntries} />
        </MantineProvider>,
      );

      expect(screen.getByText("Resolved timezone drift in calendar export")).toBeInTheDocument();
      expect(screen.getByText("Fix")).toBeInTheDocument();
      expect(screen.getByText("v1.4.1")).toBeInTheDocument();
      expect(screen.getByText(formatDate("2026-09-01"))).toBeInTheDocument();
      expect(screen.getByText("Accurate UTC parsing")).toBeInTheDocument();
    });

    it("renders empty state behavior when no entries match", () => {
      render(
        <MantineProvider>
          <WhatsNewPage entries={[]} />
        </MantineProvider>,
      );

      expect(screen.getByRole("heading", { name: /no updates yet/i })).toBeInTheDocument();
      expect(
        screen.getByText(/we have not posted any release notes yet/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(whatsNewEntries[0].title)).not.toBeInTheDocument();
    });
  });

  describe("Navigation Integration", () => {
    function renderAppShell(initialPath = "/") {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: Infinity },
        },
      });
      queryClient.setQueryData(["session"], {
        id: "user-1",
        email: "demo@team-management.local",
        name: "Demo User",
        role: "admin",
      });

      return render(
        <QueryClientProvider client={queryClient}>
          <MantineProvider>
            <MemoryRouter initialEntries={[initialPath]}>
              <Routes>
                <Route element={<AppShellLayout />}>
                  <Route path="/" element={<div data-testid="dashboard-view">Dashboard Content</div>} />
                  <Route path="/whats-new" element={<WhatsNewPage />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </MantineProvider>
        </QueryClientProvider>,
      );
    }

    it("verifies that the navigation in AppShellLayout links to /whats-new on desktop", () => {
      renderAppShell("/");

      // What's New item should be rendered in desktop sidebar navigation
      const whatsNewNav = screen.getByText("What's New");
      expect(whatsNewNav).toBeInTheDocument();

      // Clicking navigates to /whats-new and renders WhatsNewPage
      fireEvent.click(whatsNewNav);

      expect(screen.getByRole("heading", { level: 1, name: /what's new/i })).toBeInTheDocument();
      expect(screen.getByText(whatsNewEntries[0].title)).toBeInTheDocument();
    });

    it("verifies that mobile drawer navigation contains What's New", () => {
      // Simulate mobile environment
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      renderAppShell("/");

      // On mobile, the burger button toggles the navigation drawer
      const burgerButton = screen.getByRole("button", { name: "Toggle navigation" });
      fireEvent.click(burgerButton);

      // What's New item should be rendered in opened drawer
      const whatsNewNav = screen.getByText("What's New");
      expect(whatsNewNav).toBeInTheDocument();

      fireEvent.click(whatsNewNav);
      expect(screen.getByRole("heading", { level: 1, name: /what's new/i })).toBeInTheDocument();
    });

    it("shows What's New header title when navigating directly to /whats-new", () => {
      renderAppShell("/whats-new");

      // AppShell header displays the active nav item label
      const headerTitle = screen.getByRole("heading", { level: 3, name: "What's New" });
      expect(headerTitle).toBeInTheDocument();
      expect(screen.getByText(whatsNewEntries[0].title)).toBeInTheDocument();
    });

    it("renders support links with correct href and rel in the app shell", () => {
      renderAppShell("/");

      const sponsorLink = screen.getByRole("link", { name: /sponsor/i });
      expect(sponsorLink).toHaveAttribute("href", "https://github.com/sponsors/lefos13");
      expect(sponsorLink).toHaveAttribute("target", "_blank");
      expect(sponsorLink).toHaveAttribute("rel", "noopener noreferrer");

      const coffeeLink = screen.getByRole("link", { name: /buy a coffee/i });
      expect(coffeeLink).toHaveAttribute("href", "https://buymeacoffee.com/lefterisev2");
      expect(coffeeLink).toHaveAttribute("target", "_blank");
      expect(coffeeLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });
});
