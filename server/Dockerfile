# syntax=docker/dockerfile:1

# Single-stage Dockerfile for the Trial Issue Log API.
# Builds and runs from the repo root context so pnpm workspace resolution
# works cleanly. Image size is bigger than a pruned multi-stage build, but
# the trade-off is reliability — pnpm + workspaces + Docker has enough
# foot-guns that one boring stage is the right call for a take-home demo.

FROM node:20-bookworm-slim

# better-sqlite3 has a native binding — needs python/make/g++ to compile.
# openssl is required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# pnpm via corepack (no global install, no extra layer)
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Manifests first — better Docker layer caching when only source changes.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json ./server/
COPY frontend/package.json ./frontend/

# Install BOTH dev and prod deps — Prisma CLI, Nest CLI, ts-node, etc. live in
# devDependencies and we need them for the build steps below. We can't set
# NODE_ENV=production yet because that would make pnpm skip devDependencies.
RUN pnpm install --frozen-lockfile --filter server... --ignore-scripts

# --ignore-scripts above skipped better-sqlite3's install hook (which compiles
# the native .node binary). We can't drop --ignore-scripts entirely because
# that would also re-trigger server's own postinstall (prisma generate) BEFORE
# the source is copied in — and that fails with `prisma: not found` under
# pnpm workspaces. Solution: rebuild the one package that needs compilation.
RUN pnpm rebuild better-sqlite3

# Now bring in the source and build.
COPY server ./server

WORKDIR /app/server

# `prisma generate` doesn't connect to the DB — it just reads schema.prisma to
# emit the typed client. But prisma.config.ts calls env('DATABASE_URL'), which
# is strict and throws if missing. Set a placeholder *only* for this RUN; the
# real URL comes from docker-compose at runtime.
RUN DATABASE_URL="file:/tmp/placeholder.db" pnpm exec prisma generate
RUN pnpm build

# Build is done — flip to production mode for the runtime.
ENV NODE_ENV=production

EXPOSE 3000

# Apply any pending migrations before starting the server. `migrate deploy`
# is the non-interactive sibling of `migrate dev` — safe for prod / CI.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
