# Trial Issue Log

A small but end-to-end web app for tracking issues observed during a clinical
trial site visit. **Backend:** NestJS + Prisma + SQLite. **Frontend:** React +
Vite + Tailwind + shadcn/ui. **Monorepo:** pnpm workspaces.

> Built as a 3–5 hour home assignment. The README is intentionally verbose
> because the rubric weights "**ability to explain architecture**" first.

---

## Quickstart

**Prereqs:** Node ≥ 20 (Node 24 LTS preferred — `.nvmrc` pins it), pnpm ≥ 9.

```bash
# 1. Install everything (workspace install via pnpm)
pnpm install

# 2. copy example env variable
cp server/.env.example server/.env

# 3. Create the SQLite DB and apply migrations
pnpm db:migrate

# 4. Run server (:3000) + frontend (:5173) together
pnpm dev
```

Open **http://localhost:5173** and sign in with `admin` / `admin`. Change those
defaults via `AUTH_USERNAME` / `AUTH_PASSWORD` in [`server/.env`](server/.env).

To seed the database from the bundled CSV:

```bash
# Option A — via the running API
curl -X POST http://localhost:3000/api/issues/import -F 'file=@issues.csv'

# Option B — one-shot script (uses the same import pipeline)
pnpm csv:import
```

To run the tests:

```bash
pnpm test
```

---

## Stack & why each piece

Every decision below has at least one alternative I considered and a reason for
not picking it — these are the things I'd defend out loud in an interview.

### Backend framework — NestJS

**Why:** opinionated DI/module structure naturally enforces SOLID (controllers
→ services → repositories), built-in `ValidationPipe` + `class-validator`
covers the "validate inputs, return 400 on bad data" requirement out-of-the-box,
exception filters give a consistent error shape, and the framework's structure
itself is a senior-engineer signal.

**Alternatives I considered:**

- **Fastify + TS:** faster, lighter, JSON-schema validation. My pick for a pure
  microservice, but for a small CRUD app where the reviewer signal is
  architecture-first, Nest wins.
- **Express + TS:** most ubiquitous, but minimal. You re-implement validation,
  error handling, DI — wasted budget in a 3–5h time-box.

**Trade-off:** Nest is heavier than the time-box strictly needs. The win is
that the structure it imposes is itself a signal.

### Database — SQLite for the assignment, Postgres for prod

**For the assignment:** SQLite via a single file at `db/data.sqlite`. Zero
infra, the file *is* the DB.

**For production:** PostgreSQL on AWS RDS. Reasons documented in the AWS
deployment section below.

**Alternatives considered:**

- Postgres for the assignment: requires a running daemon — friction for the
  reviewer.
- MongoDB: the data is relational and the schema is fixed; no upside.
- DynamoDB: zero need for KV/serverless scale here.

### ORM — Prisma 7

**Why:** best-in-class TS types (codegen produces fully-typed query results —
no `any` leaks), the migration workflow (`prisma migrate dev`) is the cleanest
of the contenders, single-source-of-truth `schema.prisma` doubles as
documentation, Nest integrates via a thin `PrismaService extends PrismaClient`
wrapper.

**Alternatives considered:**

- **TypeORM:** ships with the Nest docs, decorator coherence with Nest. Lost
  on: less rigorous types, slower project pace, awkward auto-migrations, and
  the `synchronize: true` footgun in prod.
- **Drizzle:** TS-native schema, tiny runtime, modern. Lost on: smaller
  ecosystem and harder to defend in 60 seconds if the reviewer hasn't used it.

**Prisma 7 specifics worth knowing:**

- The connection URL no longer lives in `schema.prisma`. It's in
  [`server/prisma.config.ts`](server/prisma.config.ts) (for the CLI / Migrate)
  and passed to `PrismaClient` via the **better-sqlite3 driver adapter** in
  [`server/src/prisma/prisma.service.ts`](server/src/prisma/prisma.service.ts).
- Migrations are real from day 1 — no `synchronize` shortcut.

### Frontend — React + Vite + Tailwind + shadcn/ui

**Why:** Vite gives instant HMR, Tailwind keeps styling colocated and quick,
shadcn primitives are unstyled Radix components we copy into the repo (no
runtime dep, fully ownable, accessible). **TanStack Query** handles
fetch/cache/invalidation cleanly. **react-hook-form + Zod** for forms with
instant client-side feedback (server still re-validates).

**Alternatives considered:**

- **MUI:** faster to "looks fine" but heavier bundle and generic appearance.
- **Next.js App Router:** SSR/RSC is overkill for an internal CRUD tool of
  this size.

### Spec interpretations (decisions worth flagging)

- **`site` is required and must match `^Site-\d+$`** (e.g. `Site-101`). The
  spec examples are all this pattern; enforcing it catches malformed input
  with a useful error. Real clinical CTMS systems issue site IDs upstream, so
  in prod we'd replace the regex with a lookup against a sites table. The
  CSV import surfaces malformed rows in its per-row error report — it doesn't
  refuse the whole file.
- **CSV `createdAt` is honoured** if provided (audit trail). Manual API
  creates always use `now()`.
- **CSV import is collect-and-continue** — valid rows commit in one
  transaction; invalid rows are reported but don't block the rest. Alternative
  (all-or-nothing) was rejected as worse UX for an ops user.

### Validation strategy — duplicated, deliberately

- **Server:** `class-validator` decorators on every DTO + global
  `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- **Client:** `react-hook-form` + Zod resolver for instant feedback.

The Zod schema on the client and the `class-validator` decorators on the server
are *the same rules expressed twice*. The Nest-idiomatic alternative — a
`/shared` workspace package — forces "Zod everywhere" (drop class-validator) or
"class-validator everywhere" (awkward in the browser). For a 3–5h time-box,
**duplication is cheaper than the abstraction**. The right call beyond the
time-box is to share Zod schemas and use `nestjs-zod` on the server.

### IDs — UUID v4

`@id @default(uuid())` in Prisma. Don't leak row counts, safe in URLs, portable
across DBs. For prod-at-scale on Postgres I'd switch to **UUID v7** for
index-friendly time ordering.

---

## Authentication

A **lightweight single-user JWT stub**, per the spec's nice-to-have list.

- `POST /api/auth/login` with `{ username, password }` returns
  `{ accessToken, username }`.
- Every other `/api/*` route requires `Authorization: Bearer <accessToken>`,
  enforced by a globally-applied Nest guard. Routes marked `@Public()` —
  currently just `GET /api/health` and `POST /api/auth/login` — are exempted.
- Tokens are signed HS256 with `JWT_SECRET` from env and expire after
  `JWT_EXPIRES_IN` (default `1h`).
- Frontend stores the token in `localStorage` (`til.accessToken`), attaches it
  to every request, and bounces to `/login` on any 401 from a non-auth route.

**What this stub is NOT.** Single hardcoded credential (no users table), no
bcrypt (pointless for one literal password), no refresh tokens, no login
rate-limiting, no RBAC. For prod, see the "with more time" list at the bottom.

```bash
# Get a token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"admin"}' \
  | jq -r .accessToken)

# Use it
curl http://localhost:3000/api/issues -H "authorization: Bearer $TOKEN"
```

---

## API reference

All endpoints are JSON, prefixed with `/api`. **All routes except `/api/health`
and `/api/auth/login` require `Authorization: Bearer <token>`.** Bad input →
`400` with a structured message array; missing/expired token → `401`.

| Method | Path                  | Purpose                                            |
| ------ | --------------------- | -------------------------------------------------- |
| GET    | `/api/health`         | Liveness probe                                     |
| GET    | `/api/issues`         | List with filters (see below)                      |
| POST   | `/api/issues`         | Create an issue                                    |
| GET    | `/api/issues/stats`   | Counts by status and severity                      |
| GET    | `/api/issues/sites`   | Distinct site values (populates the site dropdown) |
| POST   | `/api/issues/import`  | multipart CSV upload → bulk insert                 |
| GET    | `/api/issues/:id`     | Detail                                             |
| PATCH  | `/api/issues/:id`     | Partial update (also used for inline "Resolve")    |
| DELETE | `/api/issues/:id`     | Delete (returns `204`)                             |

### List filters

| Param      | Type                                          | Default | Notes                                                            |
| ---------- | --------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `q`        | string                                        | —       | Case-insensitive `LIKE %q%` on `title`                           |
| `status`   | `open` \| `in_progress` \| `resolved`         | —       | Exact match                                                      |
| `severity` | `minor` \| `major` \| `critical`              | —       | Exact match                                                      |
| `site`     | string                                        | —       | Exact match (spec extension — clinical reviewers think per-site) |
| `page`     | int ≥ 1                                       | 1       |                                                                  |
| `limit`    | int 1–100                                     | 20      | Capped to prevent abuse                                          |

Sorted `createdAt DESC`.

### Examples

```bash
# Create
curl -X POST http://localhost:3000/api/issues \
  -H 'content-type: application/json' \
  -d '{"title":"t","description":"d","site":"Site-1","severity":"minor"}'

# List with filters
curl 'http://localhost:3000/api/issues?status=open&severity=critical&q=temp&site=Site-101'

# Stats (dashboard)
curl http://localhost:3000/api/issues/stats
# => { "total": 4, "byStatus": {...}, "bySeverity": {...} }

# Distinct sites (filter dropdown)
curl http://localhost:3000/api/issues/sites
# => ["Site-101","Site-202","Site-303"]

# Inline resolve
curl -X PATCH http://localhost:3000/api/issues/<id> \
  -H 'content-type: application/json' \
  -d '{"status":"resolved"}'

# Delete
curl -X DELETE http://localhost:3000/api/issues/<id> -i

# CSV import
curl -X POST http://localhost:3000/api/issues/import -F 'file=@issues.csv'
# => { "imported": 4, "skipped": 0, "errors": [] }
```

### Error shape

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "title must be longer than or equal to 1 characters",
    "severity must be one of the following values: minor, major, critical"
  ]
}
```

`message` is always an array for validation errors; the frontend renders the
first item under the relevant form field.

### CSV import semantics

- `multipart/form-data`, field name `file`.
- Each row is validated with the **same `CreateIssueDto`** as the API
  (single source of truth).
- **Collect-and-continue:** valid rows are inserted in a single transaction;
  invalid rows are reported but don't block the rest.
- Returns `{ imported, skipped, errors: [{ row, messages[] }] }`.
- If a row supplies `createdAt`, we honour it (audit trail for trial data).

Alternative considered: **all-or-nothing**. Cleaner semantics but worse UX for
an ops user with one malformed row in a 500-row file. Documented choice.

---

## Database

See [`db/README.md`](db/README.md) for the schema, design choices, and index
rationale. The SQL is at [`db/schema.sql`](db/schema.sql); the canonical source
is [`server/prisma/schema.prisma`](server/prisma/schema.prisma).

---

## Project structure

```
.
├── README.md
├── package.json                 # pnpm workspace root + cross-cutting scripts
├── pnpm-workspace.yaml
├── .nvmrc
├── issues.csv                   # sample data from the spec
├── db/
│   ├── README.md                # schema reasoning + index rationale
│   ├── schema.sql               # SQLite SQL equivalent of the Prisma model
│   └── data.sqlite              # runtime (gitignored)
├── server/                      # NestJS + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma        # single source of truth
│   │   └── migrations/
│   ├── prisma.config.ts         # Prisma 7 CLI config
│   ├── src/
│   │   ├── main.ts              # ValidationPipe, CORS, /api prefix
│   │   ├── app.module.ts
│   │   ├── health.controller.ts
│   │   ├── prisma/              # PrismaService extends PrismaClient
│   │   └── issues/
│   │       ├── issues.module.ts
│   │       ├── issues.controller.ts
│   │       ├── issues.service.ts
│   │       ├── csv-import.service.ts
│   │       ├── csv-parser.ts    # pure parsing fn — separated for testability
│   │       ├── issues.types.ts  # Severity / Status TS unions
│   │       └── dto/
│   ├── scripts/
│   │   └── import-csv.ts        # one-shot CSV seed script
│   └── test/                    # Jest: DTO validation + CSV parsing
└── frontend/                    # React + Vite + Tailwind + shadcn/ui
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx              # router + layout
    │   ├── lib/                 # api client, query client, cn helper
    │   ├── components/
    │   │   ├── ui/              # shadcn primitives (button/select/dialog/…)
    │   │   ├── Layout.tsx
    │   │   ├── Filters.tsx
    │   │   ├── IssueForm.tsx
    │   │   ├── IssuesTable.tsx
    │   │   ├── CsvImportButton.tsx
    │   │   ├── SeverityBadge.tsx
    │   │   └── StatusBadge.tsx
    │   └── pages/
    │       ├── IssuesPage.tsx
    │       └── DashboardPage.tsx
    └── …
```

---

## Tests

Two test suites, run via Jest (Nest's default).

```bash
pnpm test
```

1. **`server/test/create-issue.dto.spec.ts`** — happy path + missing `title` +
   unknown `severity` + whitespace-only-title rejection. Covers the
   "validate inputs, return 400" requirement.
2. **`server/test/csv-parser.spec.ts`** — parses the bundled `issues.csv` and
   asserts row count, site distribution, and a known row's fields.

The CSV parsing logic is **separated** from the import service
(`csv-parser.ts`) precisely so that the test never touches the DB.

---

## How I'd ship this to AWS

Local-only was the chosen scope for the time-box. Here's the design for the
push, in priority order.

### Recommended production architecture

```
                                          ┌───────────────────────┐
                                          │  Browser              │
                                          └───────────┬───────────┘
                                                      │ HTTPS
                                          ┌───────────▼───────────┐
                                          │  CloudFront           │
                                          │  (ACM cert,           │
                                          │   /*  → S3 static     │
                                          │   /api/* → App Runner)│
                                          └────┬──────────────────┘
                                ┌──────────────┘
                                │
                  ┌─────────────▼──────────────┐
                  │  S3 (frontend dist/)       │
                  └────────────────────────────┘
                                │
                                ▼
                  ┌────────────────────────────┐
                  │  AWS App Runner            │
                  │  (Nest container, ECR img) │
                  │  Health check: /api/health │
                  └────────────┬───────────────┘
                               │ VPC peering / RDS Proxy
                  ┌────────────▼───────────────┐
                  │  RDS Postgres db.t4g.micro │
                  │  (free tier, auto backups) │
                  └────────────────────────────┘
```

- **Frontend:** `pnpm --filter frontend build` → `frontend/dist/` → S3 →
  CloudFront. Cheap, fast globally, zero servers to patch. CloudFront routes
  `/api/*` → App Runner so the browser never crosses origins.
- **Backend:** multi-stage Dockerfile (build → prune devDeps → run) → push to
  ECR → **AWS App Runner** auto-deploys on new image tag. App Runner handles
  TLS, scaling, blue/green deploys. Alternatives: ECS Fargate behind an ALB
  (more flexible, more YAML); Lambda + API Gateway (cold-start ugly for
  small CRUD).
- **DB:** RDS Postgres `db.t4g.micro` (free tier-eligible). Managed backups,
  point-in-time recovery, automatic minor-version patching. **SQLite was fine
  for local — not safe for prod** (single-writer, no replication).
- **Secrets:** AWS Secrets Manager (`DATABASE_URL`), injected as env vars at
  startup. Never in the image, never in git.
- **CI/CD:** GitHub Actions → on tag → build image → push to ECR → App Runner
  picks it up. `pnpm test` and `pnpm exec tsc -b` block the merge.
- **Observability:** App Runner → CloudWatch Logs by default. Add structured
  JSON logging in the Nest logger; `/api/health` is the App Runner health
  check.

### A pragmatic "free-tier demo URL" path (if I had another 2h)

Single **EC2 `t2.micro`** with Docker Compose: nginx → frontend static +
reverse-proxy `/api` → Nest container, SQLite file on a mounted EBS volume.
**Honest trade-offs:** no auto-scaling, single point of failure, snapshot-based
backups, downtime on deploy. Fine for a demo URL — **not** fine for clinical
data.

### Best practices

- Least-privilege IAM (App Runner role can read its own secret, nothing more).
- No root keys. No long-lived access keys in CI — use GitHub OIDC → AWS role.
- Security groups: RDS only reachable from the App Runner VPC connector; ALB
  (if used) only from CloudFront.
- HTTPS only, HSTS, ACM cert in `us-east-1` for CloudFront.
- Env via Secrets Manager + Parameter Store. No secrets in env files in git.
- Structured logging → CloudWatch → metric filters for `5xx` / latency alarms.

---

## Trade-offs & what I'd do with more time

Things I deliberately skipped, with the priorities I'd attack them in:

1. **Production-grade auth.** Today's stub is single-user JWT (`admin` / `admin`
   from `server/.env`). For real clinical data: Cognito user pool + RBAC (CRA,
   monitor, sponsor, read-only auditor), bcrypt-hashed user records, refresh
   tokens with rotation, login rate-limiting, `created_by` / `updated_by`
   columns, audit log entries per mutation.
2. **Soft-delete + audit log.** Mandatory for clinical data. `deleted_at`,
   `deleted_by`, separate `issue_audit_log` table capturing every mutation.
3. **Idempotent writes via `externalId @unique`.** Both the manual create and
   CSV import currently allow duplicates. Real fix: an idempotency-key column
   on `Issue`, `prisma.issue.upsert` in the service, a `crypto.randomUUID()`
   generated per-submission on the client (held in a ref so network retries
   reuse the same key), and an optional `externalId` column in the CSV format
   for stable re-imports. Same constraint covers both write paths.
   See [`db/README.md`](db/README.md) for the full reasoning.
4. **Shared Zod schemas in `/shared`.** Drop class-validator on the server,
   switch to `nestjs-zod`, reuse schemas in the React forms. Removes the
   "validation rules expressed twice" smell.
5. **Server-side `sort` param.** Spec only asks for `createdAt DESC`, but the
   UI should be able to sort by severity, status, site.
6. **Pagination UI.** API supports `page`/`limit`; UI currently shows a count
   without "next page" controls.
7. **Full-text search on Postgres.** `pg_trgm` GIN index or `tsvector`. SQLite
   can't do this efficiently.
8. **Tests deeper than the DTO.** End-to-end Supertest against an in-memory
   SQLite (`file::memory:?cache=shared`), and a couple of frontend tests with
   Vitest + Testing Library on the IssueForm validation rendering.
9. **Bundle splitting.** The Vite build warns about the >500KB chunk; trivial
   `manualChunks` for `@radix-ui/*` and `@tanstack/react-query`.
10. **Observability.** Pino + a request-id middleware on the server; OpenAPI
    doc via `@nestjs/swagger`.
11. **Real AWS push.** Build the Dockerfile, push to ECR, wire CloudFront. The
    plan is above — I just didn't spend the time-box on it.

## Scripts cheat-sheet

```bash
pnpm dev                  # server (:3000) + frontend (:5173)
pnpm build                # build both apps
pnpm test                 # server tests (Jest)
pnpm db:migrate           # prisma migrate dev
pnpm db:reset             # blow away SQLite + replay migrations
pnpm db:studio            # Prisma Studio (DB browser)
pnpm db:schema            # regenerate db/schema.sql from schema.prisma
pnpm csv:import           # seed from issues.csv via the same code path as POST /issues/import
```
