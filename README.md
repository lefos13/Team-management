# Team Management

A strict TypeScript full-stack workspace for cloud-hosted team tracking, with a React client and a Fastify + Prisma server. Each registered account owns an isolated workspace with its own projects, team members, tasks, dashboard, and calendar.

## Stack

- `client`: React, Vite, React Router, TanStack Query, React Hook Form, Mantine, FullCalendar
- `server`: Fastify, Prisma Client, PostgreSQL, Zod, cookie-based sessions, SMTP email verification
- `packages/shared`: shared DTOs and validation schemas used by both apps

## Product Scope

- Multi-account registration with `email + password`
- Email verification through 6-digit OTP sent over SMTP
- Cookie-based authenticated sessions
- Per-account isolation for projects, members, tasks, dashboard, and calendar data
- Team members remain manager-owned records only; they do not sign in

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start PostgreSQL and create a database that matches `DATABASE_URL`.

3. Copy the server env file and fill in the values:

   ```bash
   cp server/.env.example server/.env
   ```

4. Generate Prisma client and apply migrations:

   ```bash
   npm run setup
   ```

5. Start both apps:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:5173`.

## Workspace Scripts

- `npm run setup`: generate Prisma client and apply Prisma migrations
- `npm run dev`: run server and client together
- `npm run build`: build shared package, server, and client
- `npm run test`: run server and client tests
- `npm run typecheck`: strict TypeScript checks across the workspace
- `npm run deploy:production`: run the Ubuntu production bootstrap/deploy script

Server-only commands:

- `npm run prisma:generate --workspace server`
- `npm run prisma:migrate --workspace server`
- `npm run test --workspace server`

## Environment

Development values live in [server/.env.example](/Users/eevangelinos/Documents/Team management/server/.env.example).

Production values live in [server/.env.production.example](/Users/eevangelinos/Documents/Team management/server/.env.production.example).

Required production variables:

- `DATABASE_URL`
- `SESSION_SECRET`
- `CLIENT_ORIGIN`
- `APP_BASE_URL`
- `EMAIL_PROVIDER`
- `EMAIL_FROM`

For Gmail with Nodemailer:

- `EMAIL_PROVIDER=gmail`
- `GMAIL_USER=softaware.studios@gmail.com`
- `GMAIL_APP_PASSWORD=...`
- `EMAIL_FROM="Softaware Team Management <softaware.studios@gmail.com>"`
- `EMAIL_REPLY_TO=softaware.studios@gmail.com`

For generic SMTP:

- `EMAIL_PROVIDER=smtp`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE`
- `EMAIL_FROM`

## Production Deployment

The production bootstrap script is [deploy/production/deploy.sh](/Users/eevangelinos/Documents/Team management/deploy/production/deploy.sh). It targets Ubuntu 22.04/24.04 and does the following:

- installs system packages
- installs Node.js if missing
- installs PostgreSQL and PM2
- creates or updates the local PostgreSQL role/database when `DATABASE_URL` points to localhost
- installs npm dependencies
- runs Prisma generate and `migrate deploy`
- builds client and server
- starts or reloads the server with PM2 using [deploy/production/ecosystem.config.cjs](/Users/eevangelinos/Documents/Team management/deploy/production/ecosystem.config.cjs)
- serves the built React app from the same Fastify process when `client/dist` exists
- leaves reverse proxy setup to your existing nginx / proxy configuration

Typical production flow:

1. Clone the repo on the server.
2. Copy `server/.env.production.example` to `server/.env.production` and fill in real values.
3. Run:

   ```bash
   bash deploy/production/deploy.sh
   ```

After the script finishes, point your reverse proxy to the PM2-managed app separately. The Fastify server runs from `server/dist/index.js` using the `PORT` defined in `server/.env.production`, serves `/api/*` itself, and also serves the built frontend from `client/dist` for all non-API routes.

If you use Gmail, create a Google App Password for `softaware.studios@gmail.com` and place it in `GMAIL_APP_PASSWORD`. The app uses Nodemailer with Gmail transport when `EMAIL_PROVIDER=gmail`.

## Testing Notes

- Server tests start an isolated PostgreSQL instance under `/tmp/team-management-pg-test` and run Prisma migrations against it.
- OTP tests use a fixed override code only in the test environment so registration and verification flows can be asserted deterministically.
