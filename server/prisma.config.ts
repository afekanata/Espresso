import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 moved the DB connection URL out of `schema.prisma`. The CLI (Migrate,
// Studio, db push, etc.) reads it from here; the runtime PrismaClient reads it
// via the better-sqlite3 driver adapter in src/prisma/prisma.service.ts.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
