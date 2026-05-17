# syntax=docker/dockerfile:1

# Two-stage build: produce the Vite static bundle, then serve it with nginx.
# nginx also reverse-proxies /api/* to the backend container (see nginx.conf).

# ── Builder ──────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Manifests first (cache layer)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile --filter frontend...

COPY frontend ./frontend
RUN pnpm --filter frontend build

# ── Runner (nginx + static assets) ───────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
