## Problem Statement

Users of the workspace currently only have access to a single bright, light-mode interface. When working for extended periods, in low-light environments, or on high-contrast displays, this causes eye strain, fatigue, and frustration. Furthermore, users have no easy way to toggle between visual modes depending on their lighting context or system preference.

Additionally, as the workspace evolves with regular commits and feature rollouts, users and team members have no centralized, friendly place within the application to discover what has changed, what new capabilities are available, or what issues have been resolved. They are left to discover changes by chance or ask teammates. From an engineering and maintenance perspective, release notes are frequently forgotten or omitted during routine development unless there is an explicit, enforced workflow instruction that guarantees high-level user-facing updates are documented with every relevant commit.

## Solution

1. **Global Dark Theme with Responsive Toggle Switch**: Implement a complete dark theme across all application surfaces (team workspace, Kanban board, calendar, forms, modals, admin backoffice, authentication views, and public landing pages). Provide an accessible, tactile toggle switch with sun/moon indicators in primary navigation headers and mobile navigation drawers. Automatically respect system preference by default, allow manual override at any time, and persist preference across sessions in local browser storage with zero visual flicker on page load.
2. **"What's New" High-Level Changelog Page**: Introduce a dedicated, clean, responsive "What's New" page accessible from both desktop navigation and mobile menus. This page presents a chronological timeline of release entries written in user-friendly, high-level language with category chips (such as New Feature, Improvement, and Fix), dates, and descriptive summaries.
3. **Mandatory Commit Workflow Instructions**: Update the project's engineering instructions (`AGENTS.md`) to establish a permanent protocol: any commit introducing user-visible changes, UI enhancements, or behavioral fixes must update the high-level release records in the same change set.

## User Stories

1. As a team member working at night or in low-light environments, I want to switch the application to a dark theme, so that I can reduce eye strain and work comfortably.
2. As a team member who prefers a bright interface, I want to switch back to light theme at any time, so that I can read content according to my personal visual preference.
3. As a user, I want the theme toggle switch to be clearly visible and accessible from the top header on desktop screens, so that I can toggle modes with a single click from anywhere in the application.
4. As a mobile user, I want the theme toggle to be easily tappable in the mobile navigation drawer and top bar, so that I can switch themes effortlessly on small touchscreens.
5. As a user on public pages (landing, legal, login, registration), I want the theme toggle to be available, so that my viewing experience remains consistent even before logging in.
6. As an administrator in the backoffice, I want the admin dashboard and tables to support dark mode with high contrast and legible typography, so that I can review system metrics and operational records without visual fatigue.
7. As a project leader reviewing the Kanban board, I want task cards, status columns, dragging indicators, and defect tags to have distinct dark-mode styling, so that card status and priority remain immediately recognizable.
8. As a team member checking the shared calendar, I want the calendar grid, current-day indicators, and scheduled events to render with proper dark contrast, so that deadlines and schedules are easy to scan.
9. As a user opening task or project creation modals, I want dialog backgrounds, rich-text editors, date pickers, and select dropdowns to adapt to dark theme, so that bright popup flashes do not disrupt my dark-mode session.
10. As a user opening the application for the first time, I want it to automatically match my operating system's color scheme preference, so that the app feels native to my device setup right away.
11. As a user who manually selected a theme, I want my choice saved in my browser, so that the application opens with my preferred theme when I return or reload.
12. As a keyboard-only user or screen-reader user, I want the theme toggle switch to have clear ARIA attributes and focus outlines, so that I can toggle the theme using standard keyboard shortcuts and assistive technology.
13. As a team member, I want to see a "What's New" option in the main navigation menu, so that I can quickly navigate to recent updates from anywhere in my workspace.
14. As a mobile user, I want to access the "What's New" page from the mobile navigation drawer, so that I can stay updated on my phone.
15. As a visitor or unauthenticated user, I want to view the "What's New" page from the landing page or legal footer, so that I can see the active development momentum before creating an account.
16. As a team member, I want release updates on the "What's New" page to be arranged in reverse chronological order (newest first), so that I immediately see the latest updates at the top.
17. As a team member scanning updates, I want each release entry to feature a prominent title, release date, and category badges (such as Feature, Improvement, or Fix), so that I can quickly filter what matters to me.
18. As a non-technical stakeholder, I want release notes to be written in concise, high-level, benefit-driven language, so that I understand what changed without needing to read commit hashes or code diffs.
19. As a user reading a release card, I want bullet points explaining specific workflow improvements, so that I can immediately apply new capabilities to my daily tasks.
20. As a user on a mobile device, I want the "What's New" timeline cards to scale cleanly to narrow viewports without horizontal scrolling or text truncation, so that I can read updates comfortably on any screen size.
21. As a project manager, I want an empty-state or welcome message if no updates match a filter or if it's the initial release, so that the page always feels intentional.
22. As a contributing developer or AI agent, I want clear instructions in the repository guidelines mandating high-level release record updates on every user-facing commit, so that the changelog never drifts out of date.
23. As a release coordinator, I want a standardized data structure for release entries, so that contributors format entries consistently and avoid breaking the changelog feed.
24. As a quality assurance reviewer, I want the theme switch and "What's New" page to have automated regression tests at the highest integration seam, so that future refactors cannot break theme persistence or release note rendering.

## Implementation Decisions

- **Color Scheme Architecture**: Leverage the existing component library's built-in color scheme management engine (`useMantineColorScheme`) configured at the application root provider. Default color scheme set to automatically synchronize with user system preferences (`auto`) while allowing persistent manual overrides saved to browser storage under a dedicated key.
- **Surface Styling Strategy**: Extend the global style layer to define dark-mode tokens (`[data-mantine-color-scheme="dark"]`) matching the application's existing design language (slate/teal/navy). Custom background gradients, card borders, backoffice surfaces, navigation rails, and data tables must define explicit dark-mode overrides so no raw white backgrounds or invisible dark-on-dark text occur.
- **FullCalendar & Rich Text Styling**: Supply dark-theme contrast rules for embedded third-party surfaces (FullCalendar month/week grids and TipTap rich-text editing containers) to prevent bright white boxes or illegible text inside modals and calendar views.
- **Theme Toggle Component**: Build a single reusable, accessible toggle switch component featuring animated or distinct sun and moon icons, accessible ARIA attributes (`aria-label="Toggle color scheme"`), and responsive sizing. Mount this toggle in:
  - The authenticated application shell header (visible on desktop and mobile viewports)
  - The public landing page header and mobile navigation drawer
  - The administration backoffice header bar
- **"What's New" Routing & Navigation**: Register a dedicated route (`/whats-new`) accessible within the authenticated workspace shell and exposed in public navigation links. Add a prominent navigation item with an updates icon to the authenticated sidebar, mobile navigation drawer, and public landing/legal links.
- **Release Records Data Structure**: Maintain release updates in a typed client-side data module. Each entry will adhere to a defined record shape:
  - `id`: Unique identifier (string)
  - `date`: Release or milestone date in ISO format (string)
  - `version`: Version or milestone tag (string, optional)
  - `title`: High-level headline summarizing the update (string)
  - `summary`: One- to two-sentence user-centric explanation of value (string)
  - `category`: Classification indicator (`feature`, `improvement`, `fix`)
  - `highlights`: Array of concise, non-technical bullet points describing specific user-facing changes
- **"What's New" Presentation**: Construct a responsive timeline or stacked card feed component that renders release entries with date badges, category pill badges, clear typographic hierarchy, and responsive margins that satisfy mobile and desktop display standards.
- **Repository Instruction Updates**: Update the project's agent and contributor rulebook (`AGENTS.md`) to include an inviolable requirement in the "Required rules" checklist:
  - Every commit or pull request introducing user-facing behavior, UI enhancements, export changes, or defect resolutions MUST append a corresponding high-level entry to the release records module.
  - Changes must be phrased in high-level, user-friendly language (what the user can now do, rather than internal implementation mechanics). Purely internal changes (such as dependency bumps, CI configuration, or internal refactors without behavioral changes) are exempted.

## Testing Decisions

- **Testing Philosophy (External Behavior Only)**: Tests must assert user-observable behavior from the outside rather than internal state variables or specific CSS rule names. Good tests verify that clicking the toggle switch updates the document color scheme attribute, persists preference to local storage, and that navigating to the "What's New" route displays the configured release entries with their titles, dates, and category tags.
- **Highest Integration Seam**: The highest accessible seam for these client-side capabilities is the **Client Shell & Router Integration Seam** in the frontend test suite (`client/src/test/`), executed via Vitest and React Testing Library:
  - *Theme Toggle Integration Seam*: Render the shell layout containing the toggle switch within the application root providers (`MantineProvider` + `BrowserRouter`/`MemoryRouter`). Simulate user click events on the toggle button and assert that the document's color scheme attribute toggles between light and dark, and that the stored preference in `localStorage` updates accordingly.
  - *What's New Page Integration Seam*: Render the application router on the `/whats-new` route. Assert that high-level release items, headings, category chips, and highlights render into the DOM, and that empty states render gracefully when no entries are provided.
  - *Responsive Navigation Seam*: Verify that both desktop navigation rails and mobile navigation drawers contain the appropriate links and controls, satisfying the project mandate that every UI change works across mobile and desktop.
- **Prior Art**: Modeled after existing high-level shell and page integration tests in the repository, specifically `client/src/test/dashboard-page.test.tsx` and `client/src/test/admin-page.test.tsx`, which render Mantine provider trees, mock local storage, and assert rendered user-facing text and controls.

## Out of Scope

- User-account-level database persistence of theme preference (preferences are client-local via browser storage; no backend Prisma migrations or user table schema updates are required).
- Custom user-created themes or multi-palette accent pickers (the project will support the standardized light and dark palettes only).
- Dynamic backend CMS or database-backed changelog publishing system (updates are statically compiled within the application bundle with each commit to avoid server overhead and database migrations).
- Markdown parsing engine for changelog entries (structured typed records keep bundle size lightweight and rendering fast).

## Further Notes

- In compliance with `AGENTS.md`, all UI components introduced for the theme toggle and the "What's New" view must be verified on both mobile (small viewport) and desktop screen widths.
- No database migrations or deploy script alterations are necessitated by this feature set, ensuring 100% backward compatibility and safe zero-downtime deployment through `deploy/production/deploy.sh`.
