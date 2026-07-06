# Admin Backoffice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-gated `/admin` route with a secret-password login flow, a dedicated admin cookie session, and a responsive read-only backoffice for cross-account operational data.

**Architecture:** Extend the existing Fastify app with a dedicated admin auth plugin and read-only admin routes backed by explicit Prisma selects, then add a standalone client `/admin` page that checks the admin session, submits the secret password, and renders a distinct dashboard UI. Keep the change additive, cookie-based, and deploy-safe by avoiding schema changes and validating the new environment variable in the production deploy script.

**Tech Stack:** Fastify, Prisma, Zod, React, React Router, React Query, Mantine, Vitest, Supertest

---

### Task 1: Define Shared Admin Contracts

**Files:**
- Modify: `packages/shared/src/index.ts`
- Test: `server/src/test/app.test.ts`
- Test: `client/src/pages/AdminPage.test.tsx`

- [ ] **Step 1: Write the failing server contract expectation**

```ts
it("rejects admin overview requests without an admin session", async () => {
  const response = await request(app.server).get("/api/admin/overview");
  expect(response.status).toBe(401);
});
```

- [ ] **Step 2: Run the targeted server test to verify it fails**

Run: `npm run test --workspace server -- --runInBand server/src/test/app.test.ts`
Expected: FAIL because `/api/admin/overview` does not exist yet.

- [ ] **Step 3: Add shared admin schemas and DTO types**

```ts
export const adminSessionSchema = z.object({
  authenticated: z.boolean(),
});

export const adminLoginInputSchema = z.object({
  password: z.string().min(1),
});

export const adminOverviewSchema = z.object({
  totals: z.object({
    userCount: z.number().int().nonnegative(),
    verifiedUserCount: z.number().int().nonnegative(),
    projectCount: z.number().int().nonnegative(),
    taskCount: z.number().int().nonnegative(),
    invitationCount: z.number().int().nonnegative(),
    activeAccessCount: z.number().int().nonnegative(),
  }),
});
```

- [ ] **Step 4: Export matching DTO/input types**

```ts
export type AdminSessionDTO = z.infer<typeof adminSessionSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginInputSchema>;
export type AdminOverviewDTO = z.infer<typeof adminOverviewSchema>;
```

- [ ] **Step 5: Run shared typecheck**

Run: `npm run typecheck --workspace @team-management/shared`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat: add shared admin contracts"
```

### Task 2: Add Server-Side Admin Session Auth

**Files:**
- Modify: `server/src/config.ts`
- Modify: `server/src/app.ts`
- Create: `server/src/lib/admin-auth.ts`
- Create: `server/src/plugins/admin-auth.ts`
- Create: `server/src/routes/admin.ts`
- Modify: `server/src/test/app.test.ts`

- [ ] **Step 1: Write the failing admin session tests**

```ts
it("creates and clears an admin session with the configured password", async () => {
  const denied = await request(app.server).post("/api/admin/session").send({ password: "wrong" });
  expect(denied.status).toBe(401);

  const accepted = await request(app.server).post("/api/admin/session").send({ password: "admin-secret" });
  expect(accepted.status).toBe(200);
  expect(accepted.headers["set-cookie"]?.[0]).toContain("admin_session");

  const cookie = accepted.headers["set-cookie"]?.[0] as string;
  const session = await request(app.server).get("/api/admin/session").set("Cookie", cookie);
  expect(session.status).toBe(200);
  expect(session.body).toEqual({ authenticated: true });

  const cleared = await request(app.server).delete("/api/admin/session").set("Cookie", cookie);
  expect(cleared.status).toBe(204);
});
```

- [ ] **Step 2: Run the targeted server test to verify it fails**

Run: `npm run test --workspace server -- --runInBand server/src/test/app.test.ts`
Expected: FAIL because the admin routes and config do not exist yet.

- [ ] **Step 3: Extend config with the admin secret**

```ts
ADMIN_ACCESS_PASSWORD: z.string().min(1),
```

- [ ] **Step 4: Add admin cookie helpers**

```ts
export const adminCookieName = "admin_session";

export function signAdminSessionValue(config: AppConfig) {
  return createHash("sha256").update(config.ADMIN_ACCESS_PASSWORD).digest("hex");
}

export function setAdminSessionCookie(reply: FastifyReply, config: AppConfig) {
  reply.setCookie(adminCookieName, signAdminSessionValue(config), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: config.NODE_ENV === "production",
    signed: true,
    maxAge: 60 * 60 * 4,
  });
}
```

- [ ] **Step 5: Add admin auth middleware**

```ts
fastify.decorate("authenticateAdmin", async function authenticateAdmin(request, reply) {
  const cookieValue = request.cookies[adminCookieName];
  if (!cookieValue) {
    throw unauthorized();
  }

  const { valid, value } = request.unsignCookie(cookieValue);
  if (!valid || value !== signAdminSessionValue(getConfig())) {
    clearAdminSessionCookie(reply);
    throw unauthorized();
  }
});
```

- [ ] **Step 6: Add admin session routes and register them**

```ts
app.post("/admin/session", async (request, reply) => { ... });
app.get("/admin/session", { preHandler: fastify.authenticateAdmin }, async () => ({ authenticated: true }));
app.delete("/admin/session", async (_request, reply) => reply.clearCookie(adminCookieName, { path: "/" }).status(204).send());
```

- [ ] **Step 7: Run the targeted server test to verify it passes**

Run: `npm run test --workspace server -- --runInBand server/src/test/app.test.ts`
Expected: PASS for the new admin session coverage.

- [ ] **Step 8: Commit**

```bash
git add server/src/config.ts server/src/app.ts server/src/lib/admin-auth.ts server/src/plugins/admin-auth.ts server/src/routes/admin.ts server/src/test/app.test.ts
git commit -m "feat: add admin session auth"
```

### Task 3: Add Read-Only Admin Data Endpoints

**Files:**
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/test/app.test.ts`

- [ ] **Step 1: Write failing admin data coverage**

```ts
it("returns read-only admin overview and entity lists", async () => {
  const login = await request(app.server).post("/api/admin/session").send({ password: "admin-secret" });
  const cookie = login.headers["set-cookie"]?.[0] as string;

  const overview = await request(app.server).get("/api/admin/overview").set("Cookie", cookie);
  expect(overview.status).toBe(200);
  expect(overview.body.totals.userCount).toBeGreaterThanOrEqual(1);

  const users = await request(app.server).get("/api/admin/users").set("Cookie", cookie);
  expect(users.status).toBe(200);
  expect(users.body[0]).toEqual(expect.objectContaining({ email: expect.any(String) }));
});
```

- [ ] **Step 2: Run the targeted server test to verify it fails**

Run: `npm run test --workspace server -- --runInBand server/src/test/app.test.ts`
Expected: FAIL because overview/list handlers are incomplete.

- [ ] **Step 3: Add explicit Prisma queries for the overview**

```ts
const [userCount, verifiedUserCount, projectCount, taskCount, invitationCount, activeAccessCount] = await Promise.all([
  prisma.user.count(),
  prisma.user.count({ where: { emailVerified: true } }),
  prisma.project.count(),
  prisma.task.count(),
  prisma.projectInvitation.count({ where: { acceptedAt: null, revokedAt: null } }),
  prisma.projectAccess.count({ where: { status: "active" } }),
]);
```

- [ ] **Step 4: Add explicit list endpoints**

```ts
app.get("/admin/users", { preHandler: fastify.authenticateAdmin }, async () => {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, emailVerified: true, emailVerifiedAt: true, createdAt: true },
  });
});
```

- [ ] **Step 5: Mirror the same pattern for projects, members, tasks, and access**

```ts
app.get("/admin/projects", { preHandler: fastify.authenticateAdmin }, async () => { ... });
app.get("/admin/members", { preHandler: fastify.authenticateAdmin }, async () => { ... });
app.get("/admin/tasks", { preHandler: fastify.authenticateAdmin }, async () => { ... });
app.get("/admin/access", { preHandler: fastify.authenticateAdmin }, async () => { ... });
```

- [ ] **Step 6: Run the targeted server test to verify it passes**

Run: `npm run test --workspace server -- --runInBand server/src/test/app.test.ts`
Expected: PASS for the new admin data assertions.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/admin.ts server/src/test/app.test.ts
git commit -m "feat: add admin read-only data endpoints"
```

### Task 4: Add Client Admin Route, Hooks, and Password Gate

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/hooks/use-app-data.ts`
- Create: `client/src/pages/AdminPage.tsx`
- Create: `client/src/pages/AdminPage.test.tsx`

- [ ] **Step 1: Write the failing client route test**

```tsx
it("shows the admin password form before an admin session exists", async () => {
  render(<App />);
  window.history.pushState({}, "", "/admin");
  expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the client test to verify it fails**

Run: `npm run test --workspace client -- AdminPage.test.tsx`
Expected: FAIL because the route and page do not exist yet.

- [ ] **Step 3: Add admin hooks**

```ts
export function useAdminSession() {
  return useQuery({
    queryKey: ["admin-session"],
    retry: false,
    queryFn: async () => (await api.get<AdminSessionDTO>("/admin/session")).data,
  });
}
```

- [ ] **Step 4: Add the standalone `/admin` route**

```tsx
<Route path="/admin" element={<AdminPage />} />
```

- [ ] **Step 5: Implement the locked-state form and unlock action**

```tsx
if (!adminSessionQuery.data?.authenticated) {
  return (
    <form onSubmit={form.onSubmit((values) => loginMutation.mutate(values))}>
      <PasswordInput label="Secret password" {...form.getInputProps("password")} />
      <Button type="submit">Unlock backoffice</Button>
    </form>
  );
}
```

- [ ] **Step 6: Run the client test to verify it passes**

Run: `npm run test --workspace client -- AdminPage.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/App.tsx client/src/hooks/use-app-data.ts client/src/pages/AdminPage.tsx client/src/pages/AdminPage.test.tsx
git commit -m "feat: add admin route and password gate"
```

### Task 5: Build the Backoffice Dashboard UI and Deploy Validation

**Files:**
- Modify: `client/src/pages/AdminPage.tsx`
- Modify: `client/src/styles.css`
- Modify: `deploy/production/deploy.sh`
- Modify: `server/src/test/app.test.ts`

- [ ] **Step 1: Extend the failing client test for unlocked content**

```tsx
it("renders the admin dashboard after a valid admin session is available", async () => {
  render(<AdminPage />);
  expect(await screen.findByText(/Backoffice overview/i)).toBeInTheDocument();
  expect(screen.getByText(/Users/i)).toBeInTheDocument();
  expect(screen.getByText(/Projects/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the client test to verify it fails**

Run: `npm run test --workspace client -- AdminPage.test.tsx`
Expected: FAIL because the unlocked dashboard content is not built yet.

- [ ] **Step 3: Render summary cards and responsive tables**

```tsx
<SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }}>
  <Card><Text>Total users</Text><Text>{overview.totals.userCount}</Text></Card>
</SimpleGrid>
<ScrollArea>
  <Table>...</Table>
</ScrollArea>
```

- [ ] **Step 4: Add admin-specific styling**

```css
.admin-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f4f7f9 0%, #edf3ef 100%);
}

.admin-shell-card {
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 45px rgba(15, 35, 56, 0.08);
}
```

- [ ] **Step 5: Update the deploy script env validation**

```bash
if [[ -z "${DATABASE_URL:-}" || -z "${APP_BASE_URL:-}" || -z "${CLIENT_ORIGIN:-}" || -z "${SESSION_SECRET:-}" || -z "${EMAIL_PROVIDER:-}" || -z "${ADMIN_ACCESS_PASSWORD:-}" ]]; then
  echo "DATABASE_URL, APP_BASE_URL, CLIENT_ORIGIN, SESSION_SECRET, EMAIL_PROVIDER, and ADMIN_ACCESS_PASSWORD must be set in $ENV_FILE."
  exit 1
fi
```

- [ ] **Step 6: Run project verification**

Run: `npm run test --workspace server -- --runInBand server/src/test/app.test.ts`
Expected: PASS

Run: `npm run test --workspace client -- AdminPage.test.tsx`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/AdminPage.tsx client/src/styles.css deploy/production/deploy.sh server/src/test/app.test.ts
git commit -m "feat: add admin backoffice dashboard"
```

## Self-Review

- Spec coverage:
  - `/admin` route: Task 4
  - secret-password gate via env var: Tasks 2 and 5
  - read-only backoffice data: Task 3
  - responsive UI: Task 5
  - deploy alignment: Task 5
- Placeholder scan: no `TODO`, `TBD`, or deferred implementation markers remain in the plan.
- Type consistency:
  - `AdminSessionDTO`, `AdminLoginInput`, and `AdminOverviewDTO` are defined in Task 1 and reused consistently later.
