-- Database schema for the Multi-Camera Health Monitor.
-- Applied idempotently on backend boot (CREATE TABLE IF NOT EXISTS), so there is
-- no separate migration tool to explain. The whole data model is three tables
-- plus a key/value thresholds table.

-- Registry of every camera we have ever seen. Upserted on first reading.
CREATE TABLE IF NOT EXISTS cameras (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only time-series of every health reading received. This is the
-- source of truth for both "current status" (latest row per camera) and
-- "historical trends" (rows within a time window).
CREATE TABLE IF NOT EXISTS readings (
  id                BIGSERIAL PRIMARY KEY,
  camera_id         TEXT NOT NULL REFERENCES cameras(id),
  ts                TIMESTAMPTZ NOT NULL DEFAULT now(),
  online            BOOLEAN NOT NULL,
  cpu               DOUBLE PRECISION NOT NULL,
  memory            DOUBLE PRECISION NOT NULL,
  storage_used_gb   DOUBLE PRECISION NOT NULL,
  storage_total_gb  DOUBLE PRECISION NOT NULL,
  latency_ms        DOUBLE PRECISION NOT NULL,
  fault_flag        BOOLEAN NOT NULL,
  heartbeat_at      TIMESTAMPTZ NOT NULL
);

-- Index that makes "latest reading per camera" and "readings in a window" fast.
CREATE INDEX IF NOT EXISTS idx_readings_camera_ts ON readings (camera_id, ts DESC);

-- Failure events. An alert is OPENED when a threshold is first breached and
-- RESOLVED (active=false, resolved_at set) when the breach clears. We never
-- delete alerts, so the table doubles as a failure history.
CREATE TABLE IF NOT EXISTS alerts (
  id               BIGSERIAL PRIMARY KEY,
  camera_id        TEXT NOT NULL REFERENCES cameras(id),
  type             TEXT NOT NULL,
  severity         TEXT NOT NULL,
  message          TEXT NOT NULL,
  threshold_value  DOUBLE PRECISION,
  observed_value   DOUBLE PRECISION,
  opened_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ,
  active           BOOLEAN NOT NULL DEFAULT true
);

-- Only one active alert of a given type may exist per camera at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_one_active_per_type
  ON alerts (camera_id, type) WHERE active;

-- Runtime-editable thresholds. Seeded from env on first boot, then edited via
-- PUT /api/thresholds. Storing them here is what makes thresholds configurable
-- "without a code change".
CREATE TABLE IF NOT EXISTS thresholds (
  key    TEXT PRIMARY KEY,
  value  DOUBLE PRECISION NOT NULL
);
