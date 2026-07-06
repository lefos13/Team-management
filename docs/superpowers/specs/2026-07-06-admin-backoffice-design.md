# Admin Backoffice Design

## Goal

Add a dedicated `/admin` route that allows a trusted operator to unlock a read-only backoffice by entering a secret password stored in an environment variable. The backoffice should provide organized visibility into the application's core data without requiring database access or user impersonation.

## Scope

This first version includes:

- A new `/admin` route in the client.
- A password gate backed by the server, not the browser.
- A short-lived admin session cookie separate from the normal user session.
- Read-only admin API endpoints.
- A responsive backoffice UI with summary metrics and data tables for core entities.
- Deploy-script validation for the new required environment variable.

This first version does not include:

- Editing or deletion controls.
- Role-based admin accounts in the database.
- Dependence on the normal app login flow.
- Database schema changes.

## Recommended Architecture

### Access model

`/admin` is a separate operational surface from the user workspace.

- Visiting `/admin` without an admin session shows a simple password form.
- Submitting the password calls a server endpoint that compares the submitted value with `ADMIN_ACCESS_PASSWORD`.
- When the password is correct, the server sets an HTTP-only cookie for the admin area.
- The cookie is used by admin-only endpoints to authorize access.
- Signing out from `/admin` clears only the admin cookie.

This keeps the secret server-side and avoids exposing it through the client bundle.

### Client routing

The client router should add `/admin` outside the existing authenticated app shell so the backoffice does not inherit the normal user workspace navigation.

Expected route behavior:

- `/admin`
  - No admin session: render password form.
  - Valid admin session: render the backoffice dashboard.

The page should own its own fetch and session check lifecycle rather than reusing the normal `RequireAuth` flow built for user sessions.

### Server routing

The server should expose a small admin module with:

- `POST /admin/session`
  - Accepts the secret password.
  - On success, creates the admin session cookie.
- `GET /admin/session`
  - Returns whether the current request has a valid admin session.
- `DELETE /admin/session`
  - Clears the admin session cookie.
- `GET /admin/overview`
  - Returns dashboard summary counts.
- `GET /admin/users`
  - Returns a read-only list of user records.
- `GET /admin/projects`
  - Returns a read-only list of projects with owner and counts.
- `GET /admin/members`
  - Returns a read-only list of team members.
- `GET /admin/tasks`
  - Returns a read-only list of tasks with project and assignee context.
- `GET /admin/access`
  - Returns invitation and project-access visibility for operational monitoring.

These endpoints should be guarded by dedicated admin middleware rather than the existing user authentication middleware.

## Security Design

### Secret handling

The admin password must be read from `ADMIN_ACCESS_PASSWORD` on the server only. The client must never receive the secret, any hash of it, or a derived token that could substitute for the real password.

### Session model

Use a dedicated signed cookie for the admin area.

Requirements:

- HTTP-only.
- SameSite and secure settings aligned with the existing production cookie strategy.
- Time-limited lifetime.
- Independent cookie name from the normal user session.

The first version can implement a stateless signed cookie if that aligns cleanly with the existing Fastify cookie setup. A database-backed admin session is unnecessary for the requested scope.

### Authorization boundary

All admin data endpoints must require the admin cookie on the server. The UI may hide or show content based on session checks, but the server remains the source of truth.

### Failure behavior

- Wrong password returns a generic invalid-password message.
- Missing or expired admin session returns unauthorized.
- No endpoint should reveal the configured password state or length.

## Backoffice UI

### Layout

The admin page should be visually distinct from the main app shell while still matching the product’s styling system.

Suggested structure:

- Top bar with title, short description, and sign-out action.
- Summary metrics row.
- Sectioned responsive data blocks below.

The design should work on mobile and desktop. On small screens, summary cards should stack and tables can become scrollable containers.

### Data presentation

The first dashboard should emphasize fast monitoring over exhaustive detail.

#### Summary cards

- Total users
- Verified users
- Total projects
- Total tasks
- Open invitations
- Active shared accesses

#### Users table

- Email
- Verified status
- Created date
- Last verification date if present

#### Projects table

- Name
- Owner email
- Status
- Member count
- Task count
- Updated date

#### Members table

- Name
- Email
- Role
- Owner account

#### Tasks table

- Title
- Project
- Status
- Primary assignee
- Deadline
- Updated date

#### Access and invitations table

- Project
- Invite email or member
- Permission
- Status
- Expiry
- Accepted or revoked timestamps where available

## Data strategy

The admin endpoints should favor explicit server-side selection and shaping instead of returning raw Prisma model payloads. This keeps the UI stable, avoids leaking unnecessary fields, and allows future UI changes without rewriting the database queries.

The first pass should reuse existing relation patterns already present in project and task routes where possible, but it should not depend on user-scoped ownership rules because the admin surface is cross-account.

## Deployment impact

This feature changes runtime configuration and must remain aligned with [`deploy/production/deploy.sh`](/Users/eevangelinos/Documents/Team%20management/deploy/production/deploy.sh).

Required updates:

- Add `ADMIN_ACCESS_PASSWORD` to the production env validation block.
- Ensure the application still starts correctly when the variable is present.
- Do not add any manual deploy-only steps outside the existing script.

No Prisma migration is required because this design is read-only and cookie-based.

## Testing Strategy

### Server

- Add route tests for successful admin login, failed admin login, protected endpoint rejection, and protected endpoint success with a valid cookie.
- Add tests for the overview and list endpoints to verify the response shape.

### Client

- Add tests for the password form flow and conditional rendering between locked and unlocked admin states where the current test setup supports it.

### Verification

- Build both server and client.
- Run the relevant automated tests.
- Manually verify `/admin` on desktop and mobile widths.

## Implementation slices

1. Add server-side admin session endpoints and middleware.
2. Add read-only admin overview and list endpoints.
3. Add the `/admin` client route with password gate and sign-out.
4. Add the backoffice dashboard UI and responsive tables.
5. Update deploy validation and run verification.

## Out-of-scope follow-ups

- Search, filtering, and pagination.
- Audit logging for admin access attempts.
- Editable admin controls.
- Per-admin identities and permission tiers.
