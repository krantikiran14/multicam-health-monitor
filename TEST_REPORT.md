# Test Report

Generated: 2026-07-08

This project has two independent test suites. Both are run in CI-style
(non-interactive) mode below. See the [README](README.md#running-the-tests) for
how to reproduce these results locally.

---

## 1. Backend — Jest (unit + integration)

Command:

```bash
# integration tests require a live Postgres reachable via TEST_DATABASE_URL
cd backend
TEST_DATABASE_URL=postgres://atri:atri@localhost:5432/atri_test npm test
```

Result:

```
PASS src/thresholds/evaluate.test.ts
PASS src/alerts/reconcile.test.ts
PASS test/api.integration.test.ts
PASS test/realtime.integration.test.ts

Test Suites: 4 passed, 4 total
Tests:       31 passed, 31 total
```

Coverage of the required areas:

| Area | File | What it verifies |
|---|---|---|
| Threshold engine (unit) | `src/thresholds/evaluate.test.ts` | Every rule (CPU, memory, storage, latency, offline/stale, fault) plus boundary cases and multi-breach; 17 tests |
| Alert lifecycle (unit) | `src/alerts/reconcile.test.ts` | Open on breach, no duplicate opens, resolve on clear, mixed passes; 5 tests |
| REST API (integration) | `test/api.integration.test.ts` | Real Postgres: ingest → status, 400 validation, alert open/resolve, summary, runtime threshold change, history; 7 tests |
| WebSocket (integration) | `test/realtime.integration.test.ts` | Real HTTP + Socket.IO: snapshot on connect, and a new snapshot pushed after an ingest; 2 tests |

> Note: the integration suites skip themselves automatically when
> `TEST_DATABASE_URL` is not set, so `npm test` still passes on a machine without
> a database (unit tests only). Tests run with `--runInBand` so the DB-backed
> suites don't race.

---

## 2. Frontend — Karma + Jasmine (headless Chrome)

Command:

```bash
cd dashboard
npm run test:ci
```

Result:

```
Chrome Headless: Executed 9 of 9 SUCCESS
TOTAL: 9 SUCCESS
```

Coverage:

| Area | File | What it verifies |
|---|---|---|
| App shell | `src/app/app.component.spec.ts` | Brand + nav links render; "Live · WebSocket" indicator shows when connected |
| API service | `src/app/api.service.spec.ts` | REST calls (history, thresholds GET/PUT) hit the right URLs with the right bodies |
| Overview page | `src/app/pages/overview.component.spec.ts` | Summary cards + per-camera cards render from a pushed snapshot; status badges; `barClass` cutoffs |

---

## Totals

| Suite | Tests | Result |
|---|---|---|
| Backend (Jest) | 31 | ✅ all pass |
| Frontend (Karma/Jasmine) | 9 | ✅ all pass |
| **Total** | **40** | **✅ all pass** |
