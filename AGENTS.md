# Agent Guidelines

All architecture, database schema, and code changes must stay aligned with [deploy/production/deploy.sh](/Users/eevangelinos/Documents/Team%20management/deploy/production/deploy.sh).

The production deploy script is the source of truth for how the application is applied in production. Any change that affects runtime behavior, build steps, migrations, environment variables, or data shape must be reviewed against that script before it is considered complete.

## Required rules

- Keep Prisma migrations backward compatible unless the deploy flow is updated to handle the transition safely.
- Do not introduce schema or code changes that require manual production intervention unless the deploy script explicitly automates that step.
- Preserve existing user data and avoid destructive database operations in production paths.
- If a change affects API contracts, build output, environment variables, or startup order, update the deploy process in the same change set.
- Verify that local development changes can still be deployed through the production script without corrupting the existing database or user data.
- If task data structure or export fields change, update the Excel export template in the same change set.
- Every UI change should happen for both mobile and desktop layouts.
- For every commit that introduces user-facing changes (new features, UX enhancements, visual updates, bug fixes, or export changes), add a high-level entry to `client/src/data/whats-new.ts` in the same change set. Keep descriptions concise, non-technical, and focused on user benefit.

## Deployment safety

Before shipping any change, confirm that:

1. `deploy/production/deploy.sh` still succeeds end to end.
2. Database migrations can run cleanly on an existing production database.
3. The application can start with existing production data and configuration.
4. No step depends on deleting, recreating, or resetting production state.

## Review standard

When in doubt, treat production safety as more important than convenience. A change is not ready if it works only on a fresh database or only with manual fixes outside the deploy script.

## Local demo account for testing

email: demo@team-management.local
password: demo-password
