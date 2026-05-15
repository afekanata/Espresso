-- Trial Issue Log — database schema (SQLite dialect)
--
-- This is the SQL equivalent of the Prisma datamodel at server/prisma/schema.prisma.
-- It is hand-checked output of `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
-- and is kept here so reviewers can read the schema without running anything.
--
-- For production-Postgres you'd swap `TEXT` enums for native PostgreSQL enum types
-- and replace `DATETIME` with `TIMESTAMPTZ`. See db/README.md.

-- CreateTable
CREATE TABLE "issues" (
    "id"          TEXT     NOT NULL PRIMARY KEY,           -- uuid v4
    "title"       TEXT     NOT NULL,
    "description" TEXT     NOT NULL,
    "site"        TEXT     NOT NULL,
    "severity"    TEXT     NOT NULL,                       -- 'minor' | 'major' | 'critical' (enforced by class-validator at API edge)
    "status"      TEXT     NOT NULL DEFAULT 'open',        -- 'open' | 'in_progress' | 'resolved'
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL
);

-- Indexes — see db/README.md for the rationale behind each one.
CREATE INDEX "issues_createdAt_idx" ON "issues"("createdAt" DESC);
CREATE INDEX "issues_status_idx"    ON "issues"("status");
CREATE INDEX "issues_severity_idx"  ON "issues"("severity");
CREATE INDEX "issues_site_idx"      ON "issues"("site");
