/* Release update entries and category definitions for the What's New changelog feed. */

export type WhatsNewCategory = "feature" | "improvement" | "fix";

export interface WhatsNewEntry {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  version?: string;
  title: string;
  summary: string;
  category: WhatsNewCategory;
  highlights: string[];
}

export const whatsNewEntries: WhatsNewEntry[] = [
  {
    id: "release-support-development",
    date: "2026-10-03",
    version: "v1.4.2",
    title: "Support MGteam Development",
    summary:
      "You can now back ongoing MGteam development and infrastructure through GitHub Sponsors and Buy Me a Coffee.",
    category: "feature",
    highlights: [
      "New community support section on the landing page",
      "Quick support links in the sidebar and mobile navigation menu",
      "Flexible contribution options via GitHub Sponsors and Buy Me a Coffee",
    ],
  },
  {
    id: "release-dark-mode-refactor-and-kanban-polish",
    date: "2026-09-02",
    version: "v1.4.1",
    title: "Dark Theme Polish & Full-Width Kanban Board",
    summary:
      "Enhanced dark theme visibility for card action icons, avatars, and attachments alongside full-width Kanban columns for wide displays.",
    category: "improvement",
    highlights: [
      "Kanban columns now stretch to utilize 100% of the screen width on wide displays",
      "High-contrast action icons, avatars, and attachment indicators in dark mode",
      "Minimal standard and defect badges with informative hover tooltips",
      "Centralized design token architecture ensuring consistent dark and light palettes across all pages",
    ],
  },
  {
    id: "release-whats-new-feed",
    date: "2026-09-02",
    version: "v1.4.0",
    title: "What's New Release Updates Feed",
    summary:
      "Stay informed with a dedicated changelog feed highlighting new capabilities, workflow improvements, and recent fixes across MGteam.",
    category: "feature",
    highlights: [
      "Direct access from both the desktop sidebar and mobile navigation drawer",
      "Color-coded category tags for features, improvements, and fixes",
      "Available to logged-in team members and public landing page visitors",
    ],
  },
  {
    id: "release-dark-theme",
    date: "2026-08-20",
    version: "v1.3.2",
    title: "Global Dark Theme & Visual Mode Toggle",
    summary:
      "Comfortable high-contrast dark mode across the entire workspace, reducing eye strain during intensive operational sprints.",
    category: "improvement",
    highlights: [
      "Seamless theme toggle preserved across browser sessions",
      "Refined palette for typography, borders, and cards in both dark and light modes",
      "Optimized contrast for data tables and task status badges",
    ],
  },
  {
    id: "release-kanban-board",
    date: "2026-08-05",
    version: "v1.3.0",
    title: "Kanban Task Board & Interactive Status Movement",
    summary:
      "Visualize project workflows with flexible Kanban columns and responsive status transitions.",
    category: "feature",
    highlights: [
      "Organize tasks by workflow status: Todo, In Progress, Blocked, and Completed",
      "Fast status transitions directly from the board view",
      "Integrated defect tracking flags and priority indicators on cards",
    ],
  },
  {
    id: "release-shared-calendar",
    date: "2026-07-15",
    version: "v1.2.0",
    title: "Shared Calendar & Client Collaboration",
    summary:
      "Collaborate seamlessly across teams and external stakeholders with unified milestone calendars and secure task sharing.",
    category: "feature",
    highlights: [
      "Monthly and weekly calendar views for upcoming deadlines and deliverables",
      "Time-limited, tokenized public preview links for external client review",
      "Cross-project timeline filtering by team member and milestone",
    ],
  },
];
