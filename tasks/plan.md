# Implementation Plan: Support the Project (Buy Me a Coffee + GitHub Sponsors)

## Overview
Bring the "Support development" block from https://omnissh-web.vercel.app/#sponsor into MGteam:
1. A full **Support section** on the public landing page (`/login`, `/register` → `AuthLandingPage`), plus a "Support" link in the landing footer.
2. A **subtle support block** inside the authenticated dashboard shell (`AppShellLayout` navbar, which also renders as the mobile drawer).

Reference content (from the OmniSSH page):
- GitHub Sponsors — `https://github.com/sponsors/lefos13` — "Monthly or one-time sponsor tiers"
- Buy Me a Coffee — `https://buymeacoffee.com/lefterisev2` — "Quick tip & one-off support"
- Pledge line: core features stay free, no ads/telemetry.

## Codebase facts (grounding)
- Client: React 19 + Vite 6 + Mantine 7 + `@tabler/icons-react`; global CSS in `client/src/styles.css` over tokens in `client/src/styles/theme-tokens.css` (light/dark via `[data-mantine-color-scheme]`). No i18n, no Tailwind.
- Landing: `client/src/pages/AuthLandingPage.tsx` renders `LandingHeader → LandingHero → WorkflowShowcase → VisibilityShowcase → CollaborationShowcase → LandingCta → LandingFooter` (barrel `client/src/components/landing/index.ts`).
- Footer: `client/src/components/landing/LandingFooter.tsx` — `footer-legal-links` group, internal links only today.
- Dashboard: `client/src/layouts/AppShellLayout.tsx` L110-117 — bottom navbar block `.shell-upgrade` ("Project focus"). Navbar uses `breakpoint: "sm"`, so the same block shows in the mobile burger drawer → one placement covers desktop + mobile.
- Tests: Vitest + RTL; patterns in `client/src/test/auth-landing-page.test.tsx` and `client/src/test/whats-new-page.test.tsx` (covers shell nav desktop + mobile drawer).
- Deploy (`deploy/production/deploy.sh`): builds client with no client env vars. No CSP/helmet in `server/src/app.ts`.

## Architecture Decisions
- **Single source of truth for links**: `client/src/data/support-links.ts` exporting a typed array (`id`, `label`, `tagline`, `description`, `href`, `cta`). Both surfaces import it. Hardcoded constants, **not** env vars → zero deploy.sh change, no build-arg plumbing.
- **Plain external links, no third-party iframes/widgets** (OmniSSH embeds `github.com/sponsors/.../button` iframes). Avoids third-party requests on page load, layout shift, and any future CSP friction. Rendered as Mantine `Button`/`Anchor` with `component="a"`, `target="_blank"`, `rel="noopener noreferrer"` (existing repo convention).
- **Icons**: `IconBrandGithub`, `IconCoffee`, `IconHeart` from `@tabler/icons-react` (already a dependency).
- **Landing placement**: new `SupportSection` between `LandingCta` and `LandingFooter`, with `id="support"` anchor; footer gets a "Support" anchor `href="#support"`. Two cards side-by-side on desktop, stacked on mobile (Mantine `SimpleGrid cols={{ base: 1, sm: 2 }}`).
- **Dashboard placement**: compact `SupportLinks` (variant `compact`) appended inside the existing `.shell-upgrade` block: one muted line + two small subtle buttons/links. No new nav item, no modal, no dismiss state (keeps it subtle and stateless).
- **Styling**: new rules in `styles.css` using existing tokens only (`--app-bg-surface*`, `--app-border*`, `--app-text-*`), with dark overrides under `[data-mantine-color-scheme="dark"]` matching current conventions.
- **No backend, schema, migration, env, or export-template changes.**

## Dependency Graph
```
support-links.ts (data)
   ├── SupportSection (landing)  ── AuthLandingPage + LandingFooter "#support" link
   └── SupportLinks compact (dashboard) ── AppShellLayout .shell-upgrade
                       └── whats-new.ts entry (after both surfaces exist)
```

## Task List

### Phase 1: Landing page (vertical slice incl. shared data)
- [ ] Task 1: Visitor sees a Support section on the landing page with working Sponsors + Coffee links
- [ ] Task 2: Landing footer links to the Support section

### Checkpoint: Landing
- [ ] `npm run test -w client` passes; `npm run typecheck` clean
- [ ] Visual check light + dark, desktop (≥1200px) + mobile (375px)

### Phase 2: Dashboard
- [ ] Task 3: Signed-in user sees a subtle support block in the dashboard sidebar / mobile drawer

### Checkpoint: Dashboard
- [ ] Tests pass; visual check desktop sidebar + mobile drawer, light + dark

### Phase 3: Release notes + deploy safety
- [ ] Task 4: What's New entry + full build/deploy-path verification

### Checkpoint: Complete
- [ ] `npm run build` (root: shared → server → client) succeeds
- [ ] All acceptance criteria met; ready for review

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Support block clutters the dashboard | Med | Compact variant, muted text, sits in existing bottom `.shell-upgrade` slot; no new nav entry |
| Dark-mode contrast on new cards | Low | Use existing tokens; verify both schemes visually |
| Navbar overflow on short mobile viewports | Low | Keep compact block ≤3 lines; verify at 375×667 |
| Links point at the OmniSSH author's accounts | Low | Confirmed by user: same accounts |
| Production deploy drift | Low | No env/schema/build-step change; `deploy.sh` untouched; confirm with root build |

## Resolved Decisions (user review 2026-10-03)
1. Accounts: **same** — `https://github.com/sponsors/lefos13`, `https://buymeacoffee.com/lefterisev2`.
2. Dashboard placement (best practice): **replace** the static decorative "Project focus" card (`.shell-upgrade`) with the compact support block. Rationale: that card is filler copy with no function; replacing it keeps the sidebar the same height (no extra clutter or mobile-drawer overflow) and puts the support ask in the conventional low-priority sidebar-footer slot. Reuse the `.shell-upgrade` container styling.
3. Copy (MGteam scope):
   - Landing eyebrow: "Community supported"
   - Landing heading: "Support MGteam development"
   - Landing body: "MGteam is free to use for your team. Your support keeps development active, covers hosting and infrastructure, and funds the next round of planning, Kanban, and reporting features."
   - GitHub Sponsors card — tagline "Monthly or one-time support"; description "Back ongoing development directly through GitHub Sponsors and help shape what ships next."; CTA "Sponsor on GitHub".
   - Buy Me a Coffee card — tagline "Quick one-off tip"; description "No recurring commitment. A coffee helps fund bug fixes, polish, and new workflow features."; CTA "Buy me a coffee".
   - Pledge line: "Core team features will always stay free — no ads, no paywalled essentials."
   - Dashboard compact block: title "Enjoying MGteam?"; text "Help keep it free and improving."; links "Sponsor" and "Buy a coffee".
4. Implementation: delegated to one Gemini subagent (Paseo profile "AGY - subagent", `antigravity-cli/gemini-3.8-flash`). Single agent, sequential tasks, because Tasks 1 and 3 share `support-links.ts` and `styles.css`. Orchestrator reviews and verifies at each checkpoint.
