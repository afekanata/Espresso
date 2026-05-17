# Deploying to AWS (EC2 + Docker Compose)

> **Audience:** this doc is for someone reproducing or extending the
> deployment, not a checklist anyone needs to run today. The live demo was
> set up by following this exact walkthrough; the **Troubleshooting**
> section at the bottom captures every issue I actually hit (buildx
> missing, pnpm-workspace native-build asymmetry, Prisma 7 strict-env
> behavior, `nest build` output path, OOM on the build) and how it was
> resolved. Read it as evidence of work done + a runbook for next time.

This is the "pragmatic free-tier" path from the README — a single EC2
`t3.micro` running the whole stack via `docker compose`. Honest trade-offs:
no auto-scaling, single point of failure, SQLite on a Docker volume rather
than RDS, HTTP-only. Fine for a demo URL; **not** what I'd ship for actual
clinical data.

For the production architecture (S3+CloudFront, App Runner, RDS Postgres),
see the "How I'd ship this to AWS" section in [README.md](README.md).

---

## Architecture on the box

```
                          EC2 t3.micro (Amazon Linux 2023)
   ┌──────────────────────────────────────────────────────┐
   │                                                      │
   │  docker compose                                      │
   │  ┌─────────────┐         ┌─────────────────────────┐ │
80 │  │   nginx     │ ──/api─►│   Nest + Prisma         │ │
─► │  │  (web svc)  │         │   (server svc)          │ │
   │  │  + static   │         │   :3000                 │ │
   │  └─────────────┘         └────────────┬────────────┘ │
   │                                       ▼              │
   │                            ┌──────────────────────┐  │
   │                            │  sqlite_data volume  │  │
   │                            │  /data/data.sqlite   │  │
   │                            └──────────────────────┘  │
   └──────────────────────────────────────────────────────┘
```

---

## 0. Prerequisites

- An **AWS account**. Free-tier eligibility helps but isn't required — a
  t3.micro running for the duration of a take-home interview costs a couple
  of dollars at most. Free-tier coverage varies by region and account age;
  check the billing dashboard before you launch.
- The **repo pushed to GitHub** (Phase 1 from the assistant's checklist).
- A way to generate a random string for `JWT_SECRET`:
  ```sh
  openssl rand -hex 32
  ```

---

## 1. Launch the EC2 instance

In the AWS Console → EC2 → Launch instances:

| Setting | Value |
|---|---|
| Name | `trial-issue-log` |
| AMI | **Amazon Linux 2023** (free tier eligible) |
| Instance type | **t3.micro** (newer than t2.micro, similar price, unlimited CPU credits by default — recommended). t2.micro also works if t3 isn't available. |
| Key pair | Create a new one (e.g. `til-key`) — download the `.pem` |
| Security group | Create new; rules below |
| Storage | 30 GB gp3 (free tier ceiling) |

Security group rules:

| Type | Port | Source | Why |
|---|---|---|---|
| SSH | 22 | **Your IP only** (My IP) | shell access |
| HTTP | 80 | 0.0.0.0/0 | public demo URL |
| HTTPS | 443 | 0.0.0.0/0 | only if you add TLS later |

After launch, note the **public IPv4 DNS** (e.g. `ec2-3-87-xx-xx.compute-1.amazonaws.com`).

---

## 2. SSH in and install Docker + git

```sh
chmod 400 ~/Downloads/til-key.pem
ssh -i ~/Downloads/til-key.pem ec2-user@<public-dns>
```

On the instance:

```sh
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

# Docker Compose v2 plugin
sudo mkdir -p /usr/libexec/docker/cli-plugins
sudo curl -SL \
  https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/libexec/docker/cli-plugins/docker-compose
sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose

# buildx plugin (required by Compose v2 — AL2023's docker package doesn't ship it)
BUILDX_VERSION=$(curl -fsSL https://api.github.com/repos/docker/buildx/releases/latest \
  | grep '"tag_name"' | sed -E 's/.*"([^"]+)"[^"]*$/\1/')
sudo curl -SL \
  "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-amd64" \
  -o /usr/libexec/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/libexec/docker/cli-plugins/docker-buildx

# Re-login so the docker group takes effect
exit
ssh -i ~/Downloads/til-key.pem ec2-user@<public-dns>
docker compose version    # sanity check
docker buildx version     # sanity check
```

### Add swap (strongly recommended for t2/t3.micro)

1 GB RAM is tight for a parallel `pnpm install` + `nest build` + `vite build`.
Without swap the build will OOM and SSH itself becomes unresponsive — you'll
have to stop+start the instance to recover, which changes the public IP.
Do it once, upfront:

```sh
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify — `Swap:` row should show ~2 GB
free -m
```

---

## 3. Clone the repo and configure secrets

```sh
git clone https://github.com/<you>/trial-issue-log.git
cd trial-issue-log

cp .env.example .env
nano .env       # set AUTH_PASSWORD and JWT_SECRET to real values
```

Required env vars (the `:?must be set` markers in `docker-compose.yml`
will fail the build if these are missing):

- `AUTH_USERNAME` — defaults to `admin`
- `AUTH_PASSWORD` — set something better than `admin`
- `JWT_SECRET` — `openssl rand -hex 32` output
- `JWT_EXPIRES_IN` — defaults to `12h`

---

## 4. Build and start

```sh
docker compose up -d --build
```

First build takes ~5–10 minutes on t3.micro (TS compile + Vite build + nginx
image pull). Watch the logs:

```sh
docker compose logs -f server
docker compose logs -f web
```

You should see Nest log lines ending in:

```
LOG [NestApplication] Nest application successfully started
API listening on http://localhost:3000/api
```

---

## 5. Verify

From your laptop:

```sh
# Health (public)
curl http://<public-dns>/api/health
# => {"status":"ok","uptime":...}

# Login
TOKEN=$(curl -s -X POST http://<public-dns>/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"<your AUTH_PASSWORD>"}' | jq -r .accessToken)

# Authenticated request
curl http://<public-dns>/api/issues -H "authorization: Bearer $TOKEN"
```

Then open **`http://<public-dns>/`** in a browser, sign in, exercise the UI.

---

## 6. Seed the database (optional)

Migrations create the table but not data. To load the bundled CSV:

```sh
# From your laptop, with TOKEN from step 5
curl -X POST http://<public-dns>/api/issues/import \
  -H "authorization: Bearer $TOKEN" \
  -F 'file=@issues.csv'

# Or from the server itself (no auth needed — runs inside the Nest process)
docker compose exec server pnpm csv:import
```

---

## 7. Operating it

```sh
# Restart after pulling new code
git pull
docker compose up -d --build

# Tail logs
docker compose logs -f

# Stop everything (data persists in the volume)
docker compose down

# Nuke including data (CAREFUL — destroys the SQLite volume)
docker compose down -v
```

Auto-start on reboot is handled by `restart: unless-stopped` in
`docker-compose.yml` plus `systemctl enable docker` from step 2.

---

## 8. Optional next steps

These aren't required for the demo URL, but they're the realistic next
steps if this were a real deployment:

- **TLS.** Put Cloudflare in front (free TLS termination — just point a
  DNS A record at the EC2 IP and toggle "Proxied"). Alternative: swap nginx
  for Caddy with auto-Let's Encrypt.
- **Domain.** Buy a domain in Route 53 or anywhere, add an A record to the
  EC2 public IP. Use an Elastic IP if you don't want the IP to change on
  stop/start.
- **Backups.** Add an EBS snapshot lifecycle policy targeting the volume
  the SQLite file lives on. Or run a nightly `docker compose exec server
  cp /data/data.sqlite /data/backups/...` cron.
- **Logs.** Ship container logs to CloudWatch via the awslogs driver
  (`logging:` block in docker-compose.yml).
- **Migrate to Postgres.** Swap `provider = "sqlite"` for `"postgresql"`,
  add an RDS instance to the security group, point `DATABASE_URL` at it.
  See the README's "How I'd ship this to AWS" for the full prod story.

---

## Troubleshooting

Everything below was hit at least once during my first walk through this
guide. The Dockerfiles in the repo already have the fixes baked in — but
this is what to look for if you encounter the same symptoms in your own
context (e.g. a slightly different AL2023 AMI, a different region, a
forked variant of the project).

| Symptom | Likely cause | Fix |
|---|---|---|
| `permission denied` on `docker compose` | docker group not applied | `exit` and SSH back in |
| `compose build requires buildx 0.17.0 or later` | buildx plugin missing | install buildx (see step 2 above — it's in the standard setup now) |
| `gyp ERR! find Python … Python is not set` in frontend image | better-sqlite3 trying to compile in the frontend builder | the frontend Dockerfile uses `--ignore-scripts` — already fixed in repo |
| `prisma: not found` during server `pnpm install` | server's `postinstall: prisma generate` ran before source was copied | removed from `server/package.json`; Dockerfile runs `prisma generate` explicitly |
| `Could not find native binding … better_sqlite3.node` at runtime | native binding skipped during install | install scripts must run for server (no `--ignore-scripts` there) |
| `Cannot find module '/app/server/dist/main.js'` at runtime | `nest build` emitted to `dist/src/main.js` | `server/tsconfig.build.json` restricts the build to `src/` so output flattens to `dist/main.js` |
| `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` during `prisma generate` | `env('DATABASE_URL')` in `prisma.config.ts` is strict | the Dockerfile passes a placeholder `DATABASE_URL=file:/tmp/placeholder.db` just for that RUN |
| `prisma migrate deploy` fails with `P3005` | DB schema diverged | nuke the volume: `docker compose down -v` then up |
| `502 Bad Gateway` from nginx | the server container is in a crash loop | `docker compose logs server --tail 50` to see why |
| Build OOMs with `Killed` or SSH hangs partway through build | t2/t3.micro RAM exhausted | add the 2 GB swap file from step 2 (do this **before** the build, not after) |
| Web hangs on first request | t2 CPU credits exhausted | wait a minute, or upsize to t3.micro (which uses unlimited credits by default) |
| `gyp ERR!` building better-sqlite3 *in the server image* | python/make/g++ missing | already installed via `apt-get` in `server/Dockerfile` |

### The `--ignore-scripts` asymmetry — worth remembering

The frontend and server Dockerfiles install pnpm deps **differently**:

- **Frontend:** `pnpm install --filter frontend... --ignore-scripts` — skips
  lifecycle scripts. Required because the workspace lockfile includes
  `better-sqlite3` (a server dep) which would try to compile a native binding
  in an image that has no python/make/g++.
- **Server:** `pnpm install --filter server...` — full scripts. Required
  because `better-sqlite3`'s install hook is what compiles the `.node` binary
  that the runtime needs.

If you ever copy this Dockerfile setup to a new project, that asymmetry is
the load-bearing bit. Make sure the image that *uses* a native dep has the
toolchain AND runs install scripts; the image that doesn't need it skips
both.
