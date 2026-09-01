# Cloud Console Database (Auth + Organization/Projects) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `apps/cloud` real multi-organization authentication (Better Auth) and a
Drizzle-backed data model (organization → project → environment → API key), replacing the
mocked data in `apps/cloud/lib/cloud-data.ts` for that slice, with an audit log recording
every mutation.

**Architecture:** A Postgres database dedicated to `apps/cloud`, fully separate from the
self-hosted `telemetry`/`app` schemas. Better Auth owns `user`, `session`, `account`,
`verification`, `organization`, `member`, `invitation`, `apikey` (generated, never
hand-edited). A hand-written Drizzle schema owns `project`, `environment`, `audit_log`,
which reference the Better Auth tables by foreign key. Both schemas are combined into one
Drizzle client and one migration history.

**Tech Stack:** Next.js 16 (apps/cloud), Better Auth (`organization` + `apiKey` plugins,
email/password + Google OAuth), Drizzle ORM + `drizzle-kit`, `pg` (node-postgres), `zod`
for env validation, `bun test` for tests.

**Spec:** `docs/superpowers/specs/2026-09-01-cloud-console-db-design.md`

## Global Constraints

- **`apps/cloud` is its own git repository, excluded from the `lumyx` monorepo
  (`.gitignore:20`, remote `git@github.com:FrekiManagarm/lumyx-cloud.git`).** Every commit
  step in this plan runs `git -C apps/cloud ...` (or `cd apps/cloud` first) — never commit
  cloud-app files from the root `lumyx` repo, and never expect `git status` at the repo
  root to show them.
- The self-hosted database (`telemetry`/`app` schemas, PR #4) and this Cloud database share
  **no** schema, table, or migration history. Do not import from `packages/db` or
  `packages/auth` — both stay empty scaffolds (design §4.1).
- Billing, usage, quotas, invoices, and outbound webhooks are **out of scope** (design §3,
  §4.6) — do not add tables or fields for them.
- Better Auth model names, not table names, drive adapter config (`modelName` refers to the
  Better Auth model, e.g. `"user"`, even if the SQL table were ever renamed).
- `auth-schema.ts` is **generated** by `@better-auth/cli generate` and is never hand-edited
  except for the one documented exception in Task 5 (adding FK constraints to the
  migration SQL, not to the generated schema file itself).

---

## Task 1: Dependencies and environment schema

**Files:**
- Modify: `apps/cloud/package.json`
- Create: `apps/cloud/lib/env.ts`
- Create: `apps/cloud/.env.example`
- Modify: `apps/cloud/.gitignore` (verify `.env*.local` is covered — it already inherits
  from the repo's own `.gitignore`, confirm before adding anything)

**Interfaces:**
- Produces: `env` — a parsed, typed object exported from `apps/cloud/lib/env.ts` with
  fields `CLOUD_DATABASE_URL: string`, `BETTER_AUTH_SECRET: string`,
  `BETTER_AUTH_URL: string`, `GOOGLE_CLIENT_ID: string`, `GOOGLE_CLIENT_SECRET: string`.
  Every later task that touches the database or Better Auth imports `{ env }` from this
  file instead of reading `process.env` directly.

- [ ] **Step 1: Install dependencies**

```bash
cd apps/cloud
bun add better-auth drizzle-orm pg
bun add -d drizzle-kit @types/pg
cd ../..
```

- [ ] **Step 2: Write the env schema**

```ts
// apps/cloud/lib/env.ts
import { z } from "zod";

const schema = z.object({
  CLOUD_DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

export const env = schema.parse({
  CLOUD_DATABASE_URL: process.env.CLOUD_DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
});
```

- [ ] **Step 3: Write a test that a missing var fails loudly**

```ts
// apps/cloud/lib/env.test.ts
import { describe, expect, test } from "bun:test";

describe("env", () => {
  test("throws when a required variable is missing", async () => {
    const original = process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_SECRET;
    try {
      await import(`./env.ts?t=${Date.now()}`);
      throw new Error("expected env.ts to throw");
    } catch (err) {
      expect(String(err)).not.toContain("expected env.ts to throw");
    } finally {
      if (original !== undefined) process.env.BETTER_AUTH_SECRET = original;
    }
  });
});
```

- [ ] **Step 4: Add `.env.example`**

```bash
# apps/cloud/.env.example
CLOUD_DATABASE_URL=postgres://postgres:postgres@localhost:5432/cloud
BETTER_AUTH_SECRET=replace-with-openssl-rand--base64-32
BETTER_AUTH_URL=http://localhost:3002
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] **Step 5: Add `"test": "bun test"` to `apps/cloud/package.json` scripts**

Confirm the `scripts` block reads:

```json
"scripts": {
  "dev": "next dev --port 3002",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "check-types": "tsc --noEmit",
  "test": "bun test",
  "verify:ds": "node scripts/verify-ds.mjs"
}
```

- [ ] **Step 6: Create a local `.env.local` from the example, run the test**

```bash
cd apps/cloud
cp .env.example .env.local
# edit .env.local: set BETTER_AUTH_SECRET to `openssl rand -base64 32`
bun test lib/env.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit (in the cloud repo, not the root repo)**

```bash
git -C apps/cloud add package.json bun.lock lib/env.ts lib/env.test.ts .env.example
git -C apps/cloud commit -m "feat: add validated env schema for auth and database vars"
```

---

## Task 2: Postgres client (schema-less bootstrap)

**Files:**
- Create: `apps/cloud/lib/db/client.ts`

**Interfaces:**
- Consumes: `env.CLOUD_DATABASE_URL` from Task 1.
- Produces: `db` — a Drizzle instance exported from `apps/cloud/lib/db/client.ts`. Task 3
  imports it for the Better Auth adapter; Task 5 rewrites this file to pass the combined
  schema once it exists (documented there, not here).

- [ ] **Step 1: Write the client**

```ts
// apps/cloud/lib/db/client.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../env";

export const pool = new Pool({ connectionString: env.CLOUD_DATABASE_URL });
export const db = drizzle(pool);
```

- [ ] **Step 2: Write a smoke test that the pool config is well-formed**

```ts
// apps/cloud/lib/db/client.test.ts
import { describe, expect, test } from "bun:test";
import { pool } from "./client";

describe("db client", () => {
  test("connects and can run a trivial query", async () => {
    const result = await pool.query("select 1 as one");
    expect(result.rows[0].one).toBe(1);
  });
});
```

This requires a reachable Postgres at `CLOUD_DATABASE_URL`. If you don't have one running
yet, start one now — every later task needs it too:

```bash
docker run --rm -d --name cloud-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cloud postgres:17
```

- [ ] **Step 3: Run the test**

```bash
cd apps/cloud
bun test lib/db/client.test.ts
```

Expected: PASS. If it fails with a connection error, fix `CLOUD_DATABASE_URL` in
`.env.local` before continuing — every subsequent task assumes a reachable database.

- [ ] **Step 4: Commit**

```bash
git -C apps/cloud add lib/db/client.ts lib/db/client.test.ts
git -C apps/cloud commit -m "feat: add Postgres/Drizzle client bootstrap"
```

---

## Task 3: Better Auth configuration, route handler, and client

**Files:**
- Create: `apps/cloud/lib/auth/auth.ts`
- Create: `apps/cloud/lib/auth/client.ts`
- Create: `apps/cloud/app/api/auth/[...all]/route.ts`

**Interfaces:**
- Consumes: `db` from `apps/cloud/lib/db/client.ts` (Task 2), `env` from
  `apps/cloud/lib/env.ts` (Task 1).
- Produces: `auth` (the `betterAuth()` instance, with `.api` and `.handler`) from
  `lib/auth/auth.ts`; `authClient` (with `.signUp`, `.signIn`, `.organization`,
  `.apiKey`) from `lib/auth/client.ts`. Task 4 imports `auth` to run
  `@better-auth/cli generate` against this exact file — the plugin config here is what
  determines the generated tables/fields, so `apiKey`'s `additionalFields` must be correct
  before Task 4 runs.

- [ ] **Step 1: Write the server config**

```ts
// apps/cloud/lib/auth/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins/organization";
import { apiKey } from "better-auth/plugins/api-key";
import { db } from "../db/client";
import { env } from "../env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    organization(),
    apiKey({
      additionalFields: {
        projectId: { type: "string", required: true },
        environmentId: { type: "string", required: true },
      },
    }),
  ],
});
```

- [ ] **Step 2: Write the route handler**

```ts
// apps/cloud/app/api/auth/[...all]/route.ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../lib/auth/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 3: Write the client**

```ts
// apps/cloud/lib/auth/client.ts
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { apiKeyClient } from "better-auth/client/plugins";
import { env } from "../env";

export const authClient = createAuthClient({
  baseURL: env.BETTER_AUTH_URL,
  plugins: [organizationClient(), apiKeyClient()],
});
```

- [ ] **Step 4: Run the dev server and hit the health check**

Better Auth doesn't need the database schema applied to boot the handler for a plain
health check — but it will fail on any endpoint that queries the database. Migrations
happen in Task 5. For now, verify the module loads without throwing:

```bash
cd apps/cloud
bun run check-types
```

Expected: no type errors. `auth.ts` importing cleanly (no throw at import time) is the
real gate here — a malformed plugin config throws immediately on `betterAuth(...)` call.
Confirm with:

```bash
bun -e "import('./lib/auth/auth.ts').then(() => console.log('auth config OK'))"
```

Expected: prints `auth config OK`.

- [ ] **Step 5: Commit**

```bash
git -C apps/cloud add lib/auth/auth.ts lib/auth/client.ts app/api/auth
git -C apps/cloud commit -m "feat: configure Better Auth (organization + apiKey plugins)"
```

---

## Task 4: Generate the Better Auth schema

**Files:**
- Create: `apps/cloud/lib/db/schema/auth-schema.ts` (generated — commit as-is)

**Interfaces:**
- Consumes: `auth` from Task 3 (the CLI imports `lib/auth/auth.ts` to read the plugin
  config).
- Produces: Drizzle table exports `user`, `session`, `account`, `verification`,
  `organization`, `member`, `invitation`, `apikey` from
  `apps/cloud/lib/db/schema/auth-schema.ts`. Task 5 imports `organization` and `user` from
  here for foreign keys, and imports `apikey` to locate the exact generated column names
  for `projectId`/`environmentId`.

- [ ] **Step 1: Run the generator**

```bash
cd apps/cloud
mkdir -p lib/db/schema
bunx @better-auth/cli generate --config lib/auth/auth.ts --output lib/db/schema/auth-schema.ts -y
```

- [ ] **Step 2: Confirm the expected tables were generated**

```bash
grep -E "^export const (user|session|account|verification|organization|member|invitation|apikey) =" lib/db/schema/auth-schema.ts
```

Expected: eight matching lines, one per model listed.

- [ ] **Step 3: Note the exact generated column names for the api key scope fields**

```bash
grep -A2 "export const apikey" lib/db/schema/auth-schema.ts
```

Record the two column identifiers used for `projectId` and `environmentId` (Better
Auth's Drizzle generator emits camelCase field names as the Drizzle property but
snake_case as the SQL column, e.g. `projectId: text("project_id")`) — Task 5 needs
these exact names when it adds the foreign key constraint.

- [ ] **Step 4: Commit the generated file**

```bash
git -C apps/cloud add lib/db/schema/auth-schema.ts
git -C apps/cloud commit -m "chore: generate Better Auth Drizzle schema"
```

---

## Task 5: Application schema, combined client, and initial migration

**Files:**
- Create: `apps/cloud/lib/db/schema/app-schema.ts`
- Create: `apps/cloud/lib/db/schema/index.ts`
- Modify: `apps/cloud/lib/db/client.ts` (pass the combined schema)
- Modify: `apps/cloud/lib/auth/auth.ts` (pass the combined schema to the adapter)
- Create: `apps/cloud/drizzle.config.ts`
- Create: `apps/cloud/drizzle/0000_*.sql` (generated, then hand-edited)

**Interfaces:**
- Consumes: `organization`, `user`, `apikey` from `lib/db/schema/auth-schema.ts` (Task 4);
  the exact `apikey` column names for `projectId`/`environmentId` recorded in Task 4 Step 3.
- Produces: `project`, `environment`, `auditLog` Drizzle tables from
  `lib/db/schema/app-schema.ts`; `schema` (the combined object) from
  `lib/db/schema/index.ts`. Task 6 and Task 7 import `project`, `environment`, `auditLog`,
  and `db` (now schema-aware) from these files.

- [ ] **Step 1: Write the application schema**

```ts
// apps/cloud/lib/db/schema/app-schema.ts
import { pgTable, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema";

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.organizationId, table.slug)],
);

export const environment = pgTable(
  "environment",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.projectId, table.slug)],
);

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Write the combined schema index**

```ts
// apps/cloud/lib/db/schema/index.ts
export * from "./auth-schema";
export * from "./app-schema";
```

- [ ] **Step 3: Wire the combined schema into the Drizzle client**

```ts
// apps/cloud/lib/db/client.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../env";
import * as schema from "./schema";

export const pool = new Pool({ connectionString: env.CLOUD_DATABASE_URL });
export const db = drizzle(pool, { schema });
```

- [ ] **Step 4: Pass the schema to the Better Auth adapter too**

In `apps/cloud/lib/auth/auth.ts`, change:

```ts
database: drizzleAdapter(db, { provider: "pg" }),
```

to:

```ts
database: drizzleAdapter(db, { provider: "pg", schema }),
```

and add the import at the top: `import * as schema from "../db/schema";`.

- [ ] **Step 5: Write `drizzle.config.ts`**

```ts
// apps/cloud/drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import { env } from "./lib/env";

export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: env.CLOUD_DATABASE_URL },
});
```

- [ ] **Step 6: Generate the initial migration**

```bash
cd apps/cloud
bunx drizzle-kit generate
```

This produces `drizzle/0000_<generated-name>.sql` containing every table from both
schema files.

- [ ] **Step 7: Add the two foreign keys `additionalFields` couldn't express**

Open the generated SQL file. Using the exact `apikey` column names recorded in Task 4
Step 3 (written here as `project_id` / `environment_id` — substitute if the generator
produced different names), append at the end of the file:

```sql
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_project_id_project_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_environment_id_environment_id_fk"
  FOREIGN KEY ("environment_id") REFERENCES "environment"("id") ON DELETE CASCADE;
```

This is the one place this plan hand-edits a Drizzle-managed SQL file rather than the
schema TypeScript — `additionalFields` on a plugin table has no way to declare a foreign
key, and `auth-schema.ts` must stay purely generated (design §4.7).

- [ ] **Step 8: Apply the migration to the dev database**

```bash
bunx drizzle-kit migrate
```

- [ ] **Step 9: Verify the foreign keys landed**

```bash
bun -e "
import { pool } from './lib/db/client';
const r = await pool.query(\`select conname from pg_constraint where conname like 'apikey_%_fk'\`);
console.log(r.rows);
process.exit(0);
"
```

Expected: two rows, `apikey_project_id_project_id_fk` and
`apikey_environment_id_environment_id_fk`.

- [ ] **Step 10: Verify Better Auth's health check**

```bash
cd apps/cloud
bun run dev &
sleep 2
curl -s http://localhost:3002/api/auth/ok
kill %1
```

Expected: `{"status":"ok"}` (extra fields are fine).

- [ ] **Step 11: Commit**

```bash
git -C apps/cloud add lib/db/schema/app-schema.ts lib/db/schema/index.ts lib/db/client.ts \
  lib/auth/auth.ts drizzle.config.ts drizzle/
git -C apps/cloud commit -m "feat: add project/environment/audit_log schema and initial migration"
```

---

## Task 6: Audit log helper and Better Auth hooks

**Files:**
- Create: `apps/cloud/lib/db/audit.ts`
- Create: `apps/cloud/lib/db/audit.test.ts`
- Modify: `apps/cloud/lib/auth/auth.ts` (add `databaseHooks`)

**Interfaces:**
- Consumes: `db`, `auditLog` from Task 5.
- Produces: `logAudit(entry: { organizationId: string; actorUserId?: string | null;
  action: string; targetType: string; targetId: string; metadata?: Record<string,
  unknown> }): Promise<void>` from `apps/cloud/lib/db/audit.ts`. Task 7's project/
  environment functions call this directly.

- [ ] **Step 1: Write the failing test**

```ts
// apps/cloud/lib/db/audit.test.ts
import { describe, expect, test, beforeAll } from "bun:test";
import { db } from "./client";
import { auditLog, organization, user } from "./schema";
import { logAudit } from "./audit";
import { randomUUID } from "node:crypto";

describe("logAudit", () => {
  let organizationId: string;
  let actorUserId: string;

  beforeAll(async () => {
    organizationId = randomUUID();
    actorUserId = randomUUID();
    await db.insert(organization).values({
      id: organizationId,
      name: "Test Org",
      slug: `test-org-${organizationId}`,
      createdAt: new Date(),
    });
    await db.insert(user).values({
      id: actorUserId,
      name: "Test User",
      email: `${actorUserId}@example.com`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  test("inserts a row with the given fields", async () => {
    await logAudit({
      organizationId,
      actorUserId,
      action: "project.created",
      targetType: "project",
      targetId: "proj_123",
      metadata: { name: "demo" },
    });

    const rows = await db
      .select()
      .from(auditLog)
      .where((t) => t.organizationId as never);
    const row = rows.find((r) => r.targetId === "proj_123");
    expect(row?.action).toBe("project.created");
    expect(row?.metadata).toEqual({ name: "demo" });
  });

  test("never throws when the insert fails", async () => {
    await expect(
      logAudit({
        organizationId: "does-not-exist",
        action: "project.created",
        targetType: "project",
        targetId: "proj_456",
      }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to see it fail (module doesn't exist yet)**

```bash
cd apps/cloud
bun test lib/db/audit.test.ts
```

Expected: FAIL — `Cannot find module './audit'`.

- [ ] **Step 3: Implement `logAudit`**

```ts
// apps/cloud/lib/db/audit.ts
import { randomUUID } from "node:crypto";
import { db } from "./client";
import { auditLog } from "./schema";

export async function logAudit(entry: {
  organizationId: string;
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: randomUUID(),
      organizationId: entry.organizationId,
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata ?? {},
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("logAudit failed", { entry, err });
  }
}
```

- [ ] **Step 4: Run the test again**

```bash
bun test lib/db/audit.test.ts
```

Expected: PASS (both tests).

- [ ] **Step 5: Wire Better Auth's organization hooks to call it**

In `apps/cloud/lib/auth/auth.ts`, add:

```ts
import { logAudit } from "../db/audit";
```

and add a `databaseHooks` block to the `betterAuth({ ... })` config:

```ts
databaseHooks: {
  organization: {
    create: {
      after: async (org) => {
        await logAudit({
          organizationId: org.id,
          action: "organization.created",
          targetType: "organization",
          targetId: org.id,
          metadata: { name: org.name },
        });
      },
    },
  },
  member: {
    create: {
      after: async (member) => {
        await logAudit({
          organizationId: member.organizationId,
          actorUserId: member.userId,
          action: "member.added",
          targetType: "member",
          targetId: member.id,
          metadata: { role: member.role },
        });
      },
    },
  },
  invitation: {
    create: {
      after: async (invitation) => {
        await logAudit({
          organizationId: invitation.organizationId,
          actorUserId: invitation.inviterId,
          action: "invitation.created",
          targetType: "invitation",
          targetId: invitation.id,
          metadata: { email: invitation.email, role: invitation.role },
        });
      },
    },
  },
},
```

- [ ] **Step 6: Type-check**

```bash
bun run check-types
```

Expected: no errors. If the hook payload field names don't match (Better Auth's exact
hook argument shape can differ by version), adjust the destructured field names to match
the type error, not the other way around.

- [ ] **Step 7: Commit**

```bash
git -C apps/cloud add lib/db/audit.ts lib/db/audit.test.ts lib/auth/auth.ts
git -C apps/cloud commit -m "feat: add audit log and wire it to organization lifecycle hooks"
```

---

## Task 7: Project and environment data access functions

**Files:**
- Create: `apps/cloud/lib/db/projects.ts`
- Create: `apps/cloud/lib/db/projects.test.ts`
- Create: `apps/cloud/lib/db/environments.ts`
- Create: `apps/cloud/lib/db/environments.test.ts`

**Interfaces:**
- Consumes: `db`, `project`, `environment` from Task 5; `logAudit` from Task 6.
- Produces:
  - `createProject(input: { organizationId: string; actorUserId: string; name: string;
    slug: string }): Promise<typeof project.$inferSelect>`
  - `listProjects(organizationId: string): Promise<(typeof project.$inferSelect)[]>`
  - `createEnvironment(input: { projectId: string; actorUserId: string;
    organizationId: string; name: string; slug: string }):
    Promise<typeof environment.$inferSelect>`
  - `listEnvironments(projectId: string): Promise<(typeof environment.$inferSelect)[]>`

  Task 8's integration tests call these directly instead of going through HTTP, since
  they're plain server-side functions, not Better Auth endpoints.

- [ ] **Step 1: Write the failing project tests**

```ts
// apps/cloud/lib/db/projects.test.ts
import { describe, expect, test, beforeAll } from "bun:test";
import { randomUUID } from "node:crypto";
import { db } from "./client";
import { organization, user } from "./schema";
import { createProject, listProjects } from "./projects";

describe("projects", () => {
  let organizationId: string;
  let actorUserId: string;

  beforeAll(async () => {
    organizationId = randomUUID();
    actorUserId = randomUUID();
    await db.insert(organization).values({
      id: organizationId,
      name: "Projects Test Org",
      slug: `projects-test-${organizationId}`,
      createdAt: new Date(),
    });
    await db.insert(user).values({
      id: actorUserId,
      name: "Actor",
      email: `${actorUserId}@example.com`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  test("createProject inserts a row scoped to the organization", async () => {
    const proj = await createProject({
      organizationId,
      actorUserId,
      name: "live-classroom",
      slug: "live-classroom",
    });
    expect(proj.organizationId).toBe(organizationId);
    expect(proj.slug).toBe("live-classroom");
  });

  test("listProjects returns only that organization's projects", async () => {
    const rows = await listProjects(organizationId);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.organizationId === organizationId)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
cd apps/cloud
bun test lib/db/projects.test.ts
```

Expected: FAIL — `Cannot find module './projects'`.

- [ ] **Step 3: Implement `projects.ts`**

```ts
// apps/cloud/lib/db/projects.ts
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { project } from "./schema";
import { logAudit } from "./audit";

export async function createProject(input: {
  organizationId: string;
  actorUserId: string;
  name: string;
  slug: string;
}) {
  const [row] = await db
    .insert(project)
    .values({
      id: randomUUID(),
      organizationId: input.organizationId,
      name: input.name,
      slug: input.slug,
      createdAt: new Date(),
    })
    .returning();

  await logAudit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "project.created",
    targetType: "project",
    targetId: row.id,
    metadata: { name: input.name, slug: input.slug },
  });

  return row;
}

export async function listProjects(organizationId: string) {
  return db.select().from(project).where(eq(project.organizationId, organizationId));
}
```

- [ ] **Step 4: Run the project tests again**

```bash
bun test lib/db/projects.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing environment tests**

```ts
// apps/cloud/lib/db/environments.test.ts
import { describe, expect, test, beforeAll } from "bun:test";
import { randomUUID } from "node:crypto";
import { db } from "./client";
import { organization, user } from "./schema";
import { createProject } from "./projects";
import { createEnvironment, listEnvironments } from "./environments";

describe("environments", () => {
  let organizationId: string;
  let actorUserId: string;
  let projectId: string;

  beforeAll(async () => {
    organizationId = randomUUID();
    actorUserId = randomUUID();
    await db.insert(organization).values({
      id: organizationId,
      name: "Env Test Org",
      slug: `env-test-${organizationId}`,
      createdAt: new Date(),
    });
    await db.insert(user).values({
      id: actorUserId,
      name: "Actor",
      email: `${actorUserId}@example.com`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const proj = await createProject({
      organizationId,
      actorUserId,
      name: "webinar-us",
      slug: "webinar-us",
    });
    projectId = proj.id;
  });

  test("createEnvironment inserts a freely-named environment", async () => {
    const env = await createEnvironment({
      projectId,
      organizationId,
      actorUserId,
      name: "preview-pr-123",
      slug: "preview-pr-123",
    });
    expect(env.projectId).toBe(projectId);
    expect(env.name).toBe("preview-pr-123");
  });

  test("listEnvironments returns only that project's environments", async () => {
    const rows = await listEnvironments(projectId);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.projectId === projectId)).toBe(true);
  });
});
```

- [ ] **Step 6: Run it, confirm it fails**

```bash
bun test lib/db/environments.test.ts
```

Expected: FAIL — `Cannot find module './environments'`.

- [ ] **Step 7: Implement `environments.ts`**

```ts
// apps/cloud/lib/db/environments.ts
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { environment } from "./schema";
import { logAudit } from "./audit";

export async function createEnvironment(input: {
  projectId: string;
  organizationId: string;
  actorUserId: string;
  name: string;
  slug: string;
}) {
  const [row] = await db
    .insert(environment)
    .values({
      id: randomUUID(),
      projectId: input.projectId,
      name: input.name,
      slug: input.slug,
      createdAt: new Date(),
    })
    .returning();

  await logAudit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "environment.created",
    targetType: "environment",
    targetId: row.id,
    metadata: { name: input.name, slug: input.slug, projectId: input.projectId },
  });

  return row;
}

export async function listEnvironments(projectId: string) {
  return db.select().from(environment).where(eq(environment.projectId, projectId));
}
```

- [ ] **Step 8: Run both test files**

```bash
bun test lib/db/projects.test.ts lib/db/environments.test.ts
```

Expected: PASS (4 tests total).

- [ ] **Step 9: Commit**

```bash
git -C apps/cloud add lib/db/projects.ts lib/db/projects.test.ts \
  lib/db/environments.ts lib/db/environments.test.ts
git -C apps/cloud commit -m "feat: add project and environment data access functions"
```

---

## Task 8: End-to-end auth flow tests (API level)

**Files:**
- Create: `apps/cloud/lib/auth/auth-flows.test.ts`

**Interfaces:**
- Consumes: `auth` from Task 3/6, `createProject`/`createEnvironment` from Task 7,
  `db`/`auditLog` from Task 5.
- Produces: nothing consumed by later tasks — this is the design's §10 verification,
  exercised end-to-end.

- [ ] **Step 1: Write the test**

```ts
// apps/cloud/lib/auth/auth-flows.test.ts
import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "../db/client";
import { auditLog, apikey } from "../db/schema";
import { createProject } from "../db/projects";
import { createEnvironment } from "../db/environments";

describe("cloud console auth + data flows", () => {
  test("signup, organization creation, invite, project, environment, api key, audit log", async () => {
    const email = `owner-${Date.now()}@example.com`;

    const signUp = await auth.api.signUpEmail({
      body: { email, password: "correct horse battery staple", name: "Owner" },
    });
    expect(signUp.user.email).toBe(email);

    const headers = new Headers();
    const setCookie = signUp.headers?.get?.("set-cookie");
    if (setCookie) headers.set("cookie", setCookie);

    const org = await auth.api.createOrganization({
      body: { name: "Acme", slug: `acme-${Date.now()}` },
      headers,
    });
    expect(org?.id).toBeTruthy();
    const organizationId = org!.id;

    const invitation = await auth.api.createInvitation({
      body: {
        organizationId,
        email: `member-${Date.now()}@example.com`,
        role: "member",
      },
      headers,
    });
    expect(invitation?.organizationId).toBe(organizationId);

    const project = await createProject({
      organizationId,
      actorUserId: signUp.user.id,
      name: "live-classroom",
      slug: `live-classroom-${Date.now()}`,
    });

    const environment = await createEnvironment({
      projectId: project.id,
      organizationId,
      actorUserId: signUp.user.id,
      name: "prod",
      slug: "prod",
    });

    const key = await auth.api.createApiKey({
      body: {
        userId: signUp.user.id,
        name: "backend-prod",
        projectId: project.id,
        environmentId: environment.id,
      },
      headers,
    });
    expect(key.projectId).toBe(project.id);
    expect(key.environmentId).toBe(environment.id);

    await auth.api.revokeApiKey({ body: { keyId: key.id }, headers });
    const revoked = await db.select().from(apikey).where(eq(apikey.id, key.id));
    expect(revoked[0]?.enabled).toBe(false);

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.organizationId, organizationId));
    const actions = rows.map((r) => r.action);
    expect(actions).toContain("organization.created");
    expect(actions).toContain("invitation.created");
    expect(actions).toContain("project.created");
    expect(actions).toContain("environment.created");
  });
});
```

- [ ] **Step 2: Run it**

```bash
cd apps/cloud
bun test lib/auth/auth-flows.test.ts
```

Expected: PASS. If a Better Auth API method name or body shape doesn't match (plugin APIs
occasionally rename fields between versions), fix the call site to match the type error —
the installed `better-auth` version's types are the source of truth, not this plan.

- [ ] **Step 3: Run the full test suite**

```bash
bun test
```

Expected: every test file from Tasks 1–8 passes.

- [ ] **Step 4: Commit**

```bash
git -C apps/cloud add lib/auth/auth-flows.test.ts
git -C apps/cloud commit -m "test: cover signup-to-audit-log flow end to end"
```

---

## Task 9: Documentation

**Files:**
- Modify: `apps/cloud/README.md`

**Interfaces:** None — this task produces no code other tasks depend on.

- [ ] **Step 1: Replace the boilerplate `create-next-app` README with setup instructions**

```markdown
# `apps/cloud` — Sightline Cloud console

## Database

Requires a dedicated Postgres instance (never shared with the self-hosted `telemetry`/
`app` schemas). For local development:

\`\`\`bash
docker run --rm -d --name cloud-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cloud postgres:17
cp .env.example .env.local
# edit .env.local: set BETTER_AUTH_SECRET (openssl rand -base64 32), CLOUD_DATABASE_URL,
# GOOGLE_CLIENT_ID/SECRET
bunx drizzle-kit migrate
\`\`\`

After changing any Better Auth plugin config in `lib/auth/auth.ts`:

\`\`\`bash
bunx @better-auth/cli generate --config lib/auth/auth.ts --output lib/db/schema/auth-schema.ts -y
bunx drizzle-kit generate
bunx drizzle-kit migrate
\`\`\`

`lib/db/schema/auth-schema.ts` is generated — never hand-edit it. Application tables live
in `lib/db/schema/app-schema.ts`.

## Testing

\`\`\`bash
bun test
\`\`\`

Tests need the same Postgres instance as above, reachable at `CLOUD_DATABASE_URL`.

## Getting Started

First, run the development server:

\`\`\`bash
bun dev
\`\`\`

Open [http://localhost:3002](http://localhost:3002) with your browser to see the result.
```

- [ ] **Step 2: Commit**

```bash
git -C apps/cloud add README.md
git -C apps/cloud commit -m "docs: document database setup and migration workflow"
```
