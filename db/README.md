# Database

## What lives here

- **`schema.sql`** — the SQL equivalent of the Prisma datamodel, generated via
  `prisma migrate diff --from-empty --to-schema server/prisma/schema.prisma --script`.
  Kept in source for reviewers; the canonical source of truth is
  [`server/prisma/schema.prisma`](../server/prisma/schema.prisma).
- **`data.sqlite`** — the runtime SQLite file (gitignored, created on first
  `prisma migrate dev`).

## Why SQLite (for the assignment)

- **Zero infra.** A single file the reviewer doesn't have to install or configure.
- **Same Prisma client and same code path** as the prod target — only the
  provider line in `schema.prisma` and the driver adapter swap when we move to
  Postgres.

### Trade-offs (what we lose vs Postgres):

- **Single-writer.** Concurrent writes serialize on a file lock.
- **No native `enum`.** `severity` and `status` are stored as `TEXT`; allowed
  values are enforced at the API edge via `class-validator`'s `@IsIn` on the
  DTOs. On Postgres these become native `ENUM` types in one schema edit.
- **No real full-text search.** `LIKE '%q%'` works but won't scale; on Postgres
  we'd reach for `pg_trgm` (GIN index) or a `tsvector` column.
- **No point-in-time recovery, replication, or pooled connections.**

For prod we'd use **RDS Postgres `db.t4g.micro`** (AWS free tier). See the
"How I'd ship this to AWS" section in the top-level README.

## Schema at a glance

A single table — clinical site visits don't need a relational sprawl for this
assignment. As features grow (audit log, attachments, comments) we'd add tables
linked by `issueId`.

```
issues
├── id            text  pk   (uuid v4)
├── title         text  not null
├── description   text  not null
├── site          text  not null
├── severity      text  not null   -- 'minor' | 'major' | 'critical'
├── status        text  not null default 'open'  -- 'open' | 'in_progress' | 'resolved'
├── createdAt     datetime  default now()
└── updatedAt     datetime  auto-updated
```

### Design choices, written down

- **UUID v4 ids.** Don't leak row counts, safe to expose in URLs, portable
  across databases. For prod-at-scale on Postgres I'd switch to **UUID v7** for
  index-friendly time ordering.
- **`site` is required** even though the original spec doesn't explicitly mark
  it required — every sample row has a site, and clinical context demands it.
  Documented as an interpretation.
- **`site` is validated against `^Site-\d+$`** (e.g. `Site-101`). The spec
  examples are all this pattern; enforcing it at the API edge catches malformed
  CSV rows and bad client payloads with a clear message. Real clinical CTMS
  systems issue site IDs upstream so this would be replaced by a lookup against
  a sites table in production — documented interpretation, not a hard
  requirement of the spec.
- **CSV imports honour `createdAt`** if the row supplies one (audit trail for
  trial data); manual API creates always use `now()`.
- **`updatedAt` is maintained by Prisma**, not by a DB trigger. Prisma's
  `@updatedAt` attribute injects `updatedAt: new Date()` on every
  `update` / `upsert` call. Because every write in this app goes through
  `PrismaService`, that's sufficient. **For production-Postgres in a regulated
  clinical context I would add a `BEFORE UPDATE` trigger** as defence-in-depth
  — so a future `prisma.$executeRaw`, a maintenance script, or a second writer
  can't silently break the audit trail. (See "Migrations" below for how to add
  raw SQL to a Prisma migration.)
- **No soft-delete.** Out of scope for the time-box. For clinical data, audit
  & soft-delete (`deletedAt` + `deletedBy`) would be a day-one prod requirement.
- **Duplicates are tolerated today; idempotency would be enforced at the DB
  level in prod.** Both write paths (`POST /api/issues` and
  `POST /api/issues/import`) go through Prisma, so a single DB-level constraint
  would cover both. The correct architectural answer is an **idempotency-key
  column** — `externalId String? @unique` — with `prisma.issue.upsert({ where:
  { externalId }, ... })`. The React form generates one `crypto.randomUUID()`
  per submission (held in a ref so a network retry reuses the same key); CSV
  rows can optionally supply their own `externalId` for stable re-imports. This
  is the pattern Stripe / AWS / every payment processor uses — it correctly
  distinguishes "two attempts at one logical event" from "two genuinely
  distinct events that look alike." Heuristic alternatives (uniqueness on
  `(title, site, createdAt)` etc.) reject legitimate clinical reality where
  two separate consent-form issues can be logged at the same site on the same
  day. Skipped here for the time-box.

## Indexes — why each one

| Index | Purpose |
| --- | --- |
| `issues_createdAt_idx` on `createdAt DESC` | Every list query sorts by this. |
| `issues_status_idx` on `status` | Status filter + `GROUP BY status` for `/issues/stats`. |
| `issues_severity_idx` on `severity` | Severity filter + `GROUP BY severity` for `/issues/stats`. |
| `issues_site_idx` on `site` | Site filter + `SELECT DISTINCT site` for `/issues/sites`. |

### What we deliberately did NOT index

- **`title`** for the `LIKE '%q%'` search. A B-tree index can't be used for a
  leading-wildcard `LIKE`. For prod-Postgres I'd add a `pg_trgm` GIN index on
  `lower(title)`, or move to a `tsvector` full-text column with stemming.
- **Composite indexes** (e.g. `(status, severity, createdAt)`). Premature
  without `EXPLAIN ANALYZE` of real query shapes. At this dataset size SQLite
  does fast scans anyway; on Postgres at scale we'd add them based on the
  dominant filter patterns observed in production.
- **`updatedAt`** — never queried or sorted on in our API.

## Migrations

We use **real migrations from day 1** — no `synchronize: true` shortcut.

```bash
# create the next migration
pnpm db:migrate           # alias for `pnpm --filter server exec prisma migrate dev`

# blow it away and start fresh (DESTRUCTIVE — wipes data.sqlite)
pnpm db:reset

# regenerate db/schema.sql after a schema change
pnpm db:schema
```

Migration files live at [`server/prisma/migrations/`](../server/prisma/migrations/).
