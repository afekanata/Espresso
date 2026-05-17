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

ENV NODE_ENV=production
WORKDIR /app

# Manifests first — better Docker layer caching when only source changes.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json ./server/
COPY frontend/package.json ./frontend/

# Install only what the server workspace needs (and its transitives).
RUN pnpm install --frozen-lockfile --filter server...

# Now bring in the source and build.
COPY server ./server

WORKDIR /app/server
RUN pnpm exec prisma generate
RUN pnpm build

EXPOSE 3000

# Apply any pending migrations before starting the server. `migrate deploy`
# is the non-interactive sibling of `migrate dev` — safe for prod / CI.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
