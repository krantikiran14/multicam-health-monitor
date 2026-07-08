# Multi-Camera Health Monitor

Simulated camera devices report health metrics to a backend that stores every
reading, evaluates it against configurable thresholds, raises/resolves alerts,
and serves it all to a live auto-refreshing dashboard.

- **Live URL:** http://16.192.102.236:4000
- **API docs (Swagger UI):** http://16.192.102.236:4000/api/docs

---

## 1. Overview — what it does and how it works

The system has three moving parts and a database:

1. **Simulator** — pretends to be a fleet of cameras. Every _N_ seconds each
   camera evolves its metrics (CPU, memory, storage, latency, online/offline,
   fault flag) and `POST`s a health reading to the backend.
2. **Backend (REST API)** — receives each reading, stores it in Postgres,
   evaluates it against the current thresholds, and opens or resolves alerts
   accordingly. It also serves current status, historical trends, active alerts,
   a fleet summary, and the thresholds themselves.
3. **Dashboard** — an Angular single-page app that receives live updates over a
   **WebSocket (Socket.IO)**: the backend pushes a fresh snapshot on every change,
   so the view is always live without a manual refresh. It shows a fleet overview,
   per-camera trend charts, active alerts, and an editor for the thresholds.

The one-sentence version:

> Simulated cameras `POST` health data to an Express API, which stores every
> reading in Postgres, evaluates it against configurable thresholds to raise or
> resolve alerts, and pushes the live state to the Angular dashboard over a
> WebSocket (historical trend data is fetched over REST).

---

## 2. Architecture

```mermaid
flowchart LR
  subgraph Simulator
    S[N camera state machines<br/>random-walk metrics]
  end
  subgraph Backend["Backend (Express + TypeScript)"]
    I[POST /api/ingest]
    E[Threshold engine<br/>pure evaluate function]
    A[Alert reconcile<br/>open / resolve]
    R[Read endpoints<br/>cameras · history · alerts · summary · thresholds]
  end
  DB[(PostgreSQL<br/>readings · alerts · thresholds)]
  subgraph Dashboard["Dashboard (Angular)"]
    D[Overview · Alerts · Camera detail charts · Thresholds]
  end

  S -- "HTTP POST every 30s" --> I
  I --> E --> A --> DB
  I --> DB
  R --> DB
  I -. "on change, push snapshot" .-> WS[(Socket.IO)]
  WS -- "live cameras · alerts · summary" --> D
  D -- "GET /api/*/history · thresholds (REST)" --> R
```

**Real-time updates use a WebSocket (Socket.IO).** The dashboard opens one
connection and receives a `snapshot` event (cameras + alerts + summary) whenever
an ingest changes the data, plus a periodic push so "offline for > N seconds" is
detected even for silent cameras. Only historical trend data and threshold
reads/writes go over REST. Socket.IO auto-reconnects and falls back to HTTP
long-polling if a WebSocket can't be established.

**In production a single origin serves everything:** the Express backend serves
the built Angular app as static files, the `/api` routes, _and_ the Socket.IO
endpoint — so there is no CORS and only one URL/port (`4000`) to deploy.

**Key design points**

- **Single writer, append-only readings.** `readings` is an insert-only
  time-series; "current status" is the latest row per camera, "history" is rows
  in a time window.
- **The threshold engine is a pure function** (`backend/src/thresholds/evaluate.ts`).
  No database, no hidden clock — which makes it exhaustively unit-testable and
  easy to reason about. Alert open/resolve is a second pure function
  (`backend/src/alerts/reconcile.ts`).
- **Thresholds live in the database**, seeded from env on first boot and editable
  at runtime via `PUT /api/thresholds` — so changing alerting behaviour needs no
  code change or redeploy.
- **Trend history is downsampled server-side.** `readings` grows without bound
  as the simulator runs (one row per camera per interval, forever), so a naive
  "give me 24h of raw rows" query gets slower and heavier over time. `GET
  /cameras/:id/history` instead buckets by time and averages within each bucket
  (`backend/src/db/readings.repo.ts`), capping the response at ~180 points
  regardless of how much raw data exists underneath.

### Repository layout

```
backend/     Express + TS API, pg data layer, threshold engine, OpenAPI, seed script
simulator/   Node + TS: configurable fake cameras that POST to the backend
dashboard/   Angular app (overview, alerts, camera detail charts, thresholds)
shared/      Small TS types + camera model shared by backend & simulator
infra/       schema.sql (applied on boot)
docs/        openapi.yaml (served at /api/docs) + Postman collection
Dockerfile / simulator/Dockerfile / docker-compose.yml
```

---

## 3. Tech stack — and why

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript everywhere** | One language across simulator, backend, and dashboard — less context switching, shared types. |
| Backend | **Express + `pg` (no ORM)** | Small, explicit, parameterized SQL. Nothing hidden behind an ORM — every query is readable. |
| Database | **PostgreSQL** | A real, durable store; simple `readings`/`alerts`/`thresholds` tables; easy time-window queries for trends. |
| Frontend | **Angular 18 + RxJS** | Component structure; a small service exposes the WebSocket snapshots as an RxJS stream the views subscribe to. |
| Charts | **ng2-charts / Chart.js** | Minimal, well-known charting for the trend view. |
| Auto-refresh | **WebSocket (Socket.IO)** | Server pushes updates the instant data changes — no client polling. `NgZone.run` re-enters Angular's zone so change detection fires on each push. |
| Tests | **Jest + Supertest** (backend), **Karma + Jasmine** (frontend) | Jest for pure logic + real-DB integration; Angular's default runner for components/services. |
| Packaging | **Docker Compose** | `docker compose up` runs the whole system identically locally and on a cloud VM. |

---

## 4. Setup and run — local development

### Option A — Docker (recommended, one command)

Prerequisites: Docker Desktop.

```bash
docker compose up --build
# then, once, load 24h+ of history so the trend charts are populated:
docker compose run --rm app npm run seed
```

Open **http://localhost:4000** (dashboard) and **http://localhost:4000/api/docs**
(API docs).

### Option B — run each part directly (Node 20)

```bash
# 0. Start a Postgres (or use the compose one):
docker run -d --name atri-pg -e POSTGRES_USER=atri -e POSTGRES_PASSWORD=atri \
  -e POSTGRES_DB=atri -p 5432:5432 postgres:16-alpine

# 1. Backend
cd backend
cp .env.example .env          # adjust DATABASE_URL if needed
npm install
npm run seed                  # optional: 24h of history
npm run dev                   # http://localhost:4000

# 2. Simulator (new terminal)
cd simulator
cp .env.example .env
npm install
npm run dev

# 3. Dashboard (new terminal)
cd dashboard
npm install
npm start                     # http://localhost:4200 (proxies /api to :4000)
```

---

## 5. Deployment — AWS Free Tier

Deployed as a single **EC2** instance running the same Docker Compose stack.

1. **Launch** an EC2 `t3.micro` (or `t2.micro`) with Amazon Linux 2023 / Ubuntu.
   Allocate and associate an **Elastic IP**.
2. **Security group:** allow inbound `22` (SSH) and `4000` (the app). Add
   `80`/`443` only if you put a reverse proxy in front (see below).
3. **Install Docker + Compose:**
   ```bash
   sudo dnf install -y docker            # (Ubuntu: sudo apt-get install -y docker.io)
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER         # re-login
   sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
     -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose
   ```
4. **Clone and run:**
   ```bash
   git clone <your-repo-url> && cd <repo>
   docker compose up -d --build
   docker compose run --rm app npm run seed   # 24h history
   ```
5. The live app is now at **http://<elastic-ip>:4000**.

The WebSocket runs over the **same port 4000** as the API and dashboard, so no
extra ports or config are needed.

**Optional HTTPS with a clean domain:** register a free **DuckDNS** subdomain
pointing at the Elastic IP and put **Caddy** (automatic Let's Encrypt) in front of
the `app` service on ports 80/443. The live URL becomes
`https://<name>.duckdns.org`. Caddy proxies WebSocket upgrades automatically.

---

## 6. Configuration guide — no code changes required

**Simulator** (`simulator/.env` or compose `environment:`):

| Variable | Default | Meaning |
|---|---|---|
| `CAMERA_COUNT` | `10` | Number of cameras (minimum 5) |
| `REPORT_INTERVAL_MS` | `30000` | How often each camera reports |
| `FAULT_PROBABILITY` | `0.02` | Chance of a fault per camera per tick |
| `BACKEND_URL` | `http://localhost:4000` | Where to POST readings |

**Thresholds** — two ways to change them:

1. **At runtime (no restart):** the dashboard's **Thresholds** page, or
   `PUT /api/thresholds` with any subset of
   `{ cpuMaxPct, memoryMaxPct, storageMaxPct, latencyMaxMs, offlineSecs }`.
2. **Initial defaults:** the `CPU_MAX_PCT`, `MEMORY_MAX_PCT`, `STORAGE_MAX_PCT`,
   `LATENCY_MAX_MS`, `OFFLINE_SECS` env vars on the backend (seed the DB on first
   boot).

**Seed volume:** `SEED_HOURS` (default 26) and `SEED_INTERVAL_SECS` (default 120)
control how much history `npm run seed` generates.

---

## 7. Running the tests

**Backend** (unit + integration; integration needs a Postgres):

```bash
cd backend
# point at a throwaway test DB; the integration suite skips itself if this is unset
export TEST_DATABASE_URL=postgres://atri:atri@localhost:5432/atri_test
npm test
```

**Frontend** (headless Chrome):

```bash
cd dashboard
npm run test:ci
```

A captured pass/fail summary of both suites is in **[TEST_REPORT.md](TEST_REPORT.md)**
(37 tests total, all passing).

---

## 8. Known limitations & trade-offs

- **Single EC2 instance, no high availability.** Fine for this exercise; a real
  deployment would run multiple app instances behind a load balancer.
- **Postgres runs in a container with a volume, not managed RDS.** Simpler and
  cheaper here; RDS (managed backups, failover) is the production upgrade.
- **WebSocket fan-out is in-process (single instance).** The server broadcasts to
  all connected clients directly. Scaling to multiple app instances would need a
  Socket.IO adapter (e.g. Redis) so a push from one instance reaches clients on
  another.
- **Deploy is a manual `docker compose up`.** No CI/CD pipeline; GitHub Actions
  building images and deploying on push would be the next step.
- **Simulator, not real devices.** There is no device auth/enrolment; readings
  are trusted. Real cameras would need authentication on the ingest endpoint.
- **HTTP by default.** The bare deploy serves over HTTP on port 4000; HTTPS needs
  the optional Caddy/domain step.

---

## 9. AI tools used

- **Claude Code (Anthropic)** was used as a pair-programming assistant to
  scaffold the projects, write boilerplate, draft tests, and produce this
  documentation. All architecture decisions, the threshold/alert logic, and the
  final code were reviewed and verified end-to-end (tests run, stack brought up
  in Docker, API and dashboard checked against live data).
