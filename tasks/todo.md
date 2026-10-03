# Todo: Support the Project (Buy Me a Coffee + GitHub Sponsors)

See `tasks/plan.md` for context and decisions.

## Task 1: Landing Support section with working links

**Description:** Add shared link data and a `SupportSection` landing component (GitHub Sponsors card + Buy Me a Coffee card + pledge line), rendered between `LandingCta` and `LandingFooter` with `id="support"`.

**Acceptance criteria:**
- [x] `client/src/data/support-links.ts` exports typed entries for GitHub Sponsors (`https://github.com/sponsors/lefos13`) and Buy Me a Coffee (`https://buymeacoffee.com/lefterisev2`)
- [x] Landing page shows a "Support MGteam" section with both cards; each CTA opens in a new tab with `rel="noopener noreferrer"`
- [x] Cards are 2-up on desktop, stacked on mobile; readable in light and dark themes

**Verification:**
- [x] Tests pass: `npm run test -w client -- auth-landing-page` (assert section heading, both link `href`s, `target`, `rel`)
- [x] Typecheck: `npm run typecheck -w client`
- [x] Manual check: `/login` at 1280px and 375px, light + dark (rendered in headless Chromium, no console errors; pixel review pending human)

**Dependencies:** None

**Files likely touched:**
- `client/src/data/support-links.ts` (new)
- `client/src/components/landing/SupportSection.tsx` (new)
- `client/src/components/landing/index.ts`
- `client/src/pages/AuthLandingPage.tsx`
- `client/src/styles.css`
- `client/src/test/auth-landing-page.test.tsx`

**Estimated scope:** M

## Task 2: Footer link to Support section

**Description:** Add a "Support" anchor (`href="#support"`) to `footer-legal-links` in `LandingFooter`.

**Acceptance criteria:**
- [x] Footer shows "Support" link; clicking scrolls to the Support section
- [x] Footer still wraps cleanly on mobile

**Verification:**
- [x] Tests pass: `npm run test -w client -- auth-landing-page` (footer link `href="#support"`)
- [ ] Manual check: click footer link on desktop and mobile

**Dependencies:** Task 1

**Files likely touched:**
- `client/src/components/landing/LandingFooter.tsx`
- `client/src/test/auth-landing-page.test.tsx`

**Estimated scope:** XS

## Checkpoint: Landing
- [x] `npm run test -w client` passes
- [x] `npm run typecheck` clean
- [ ] Visual review light/dark × desktop/mobile
- [ ] Human review before Phase 2

## Task 3: Subtle dashboard support block

**Description:** Add a compact `SupportLinks` component (reusing `support-links.ts`) that **replaces** the static "Project focus" content inside the `.shell-upgrade` block at the bottom of `AppShellLayout`'s navbar — title "Enjoying MGteam?", muted line "Help keep it free and improving.", two small subtle links "Sponsor" / "Buy a coffee". Same block appears in the mobile drawer.

**Acceptance criteria:**
- [x] Desktop sidebar shows the compact block in place of "Project focus" without pushing nav items off-screen at 768px height
- [x] Mobile burger drawer shows the same block; links open in new tab with `rel="noopener noreferrer"`
- [x] Visually subordinate to navigation (small size, muted color) in light and dark

**Verification:**
- [x] Tests pass: `npm run test -w client -- whats-new-page` (or a shell test) asserting both support links render in the shell
- [x] Typecheck: `npm run typecheck -w client`
- [x] Manual check: log in as `demo@team-management.local` / `demo-password`; check sidebar at 1280px and drawer at 375px, light + dark (rendered; links/target/rel correct; no navbar overflow at 900/768/667px heights)

**Dependencies:** Task 1 (shared data)

**Files likely touched:**
- `client/src/components/SupportLinks.tsx` (new)
- `client/src/layouts/AppShellLayout.tsx`
- `client/src/styles.css`
- `client/src/test/whats-new-page.test.tsx` (or new `client/src/test/app-shell-support.test.tsx`)

**Estimated scope:** M

## Checkpoint: Dashboard
- [x] `npm run test -w client` passes
- [ ] Visual review sidebar + drawer, light + dark
- [ ] Human review before Phase 3

## Task 4: What's New entry + deploy-path verification

**Description:** Add a newest-first entry to `client/src/data/whats-new.ts` (e.g. `v1.4.2`, category `feature`, "Support MGteam development") per AGENTS.md; confirm the production build path is unaffected.

**Acceptance criteria:**
- [x] New entry at top of `whatsNewEntries` with concise, non-technical highlights (landing section, dashboard link)
- [x] `/whats-new` renders the entry
- [x] No changes required to `deploy/production/deploy.sh` (no env vars, migrations, or build steps added)

**Verification:**
- [x] Tests pass: `npm run test` (root)
- [x] Build succeeds: `npm run build` (root: shared → server → client)
- [ ] Manual check: `/whats-new` shows entry

**Dependencies:** Tasks 1–3

**Files likely touched:**
- `client/src/data/whats-new.ts`

**Estimated scope:** XS

## Checkpoint: Complete
- [x] All tests pass, root build clean
- [x] All acceptance criteria met
- [ ] Ready for review
