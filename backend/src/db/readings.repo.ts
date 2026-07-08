import { query } from './pool';
import type {
  CameraReadingInput,
  CameraSnapshot,
  TrendMetric,
  TrendPoint,
} from '../../../shared/types';
import { storageUsedPct } from '../thresholds/evaluate';

/** Insert (or update the name of) a camera so readings can reference it. */
export async function upsertCamera(cameraId: string, name: string): Promise<void> {
  await query(
    `INSERT INTO cameras (id, name) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [cameraId, name],
  );
}

/** Append one reading. `ts` defaults to now(); `at` overrides it (used by seed). */
export async function insertReading(r: CameraReadingInput, at?: Date): Promise<void> {
  await query(
    `INSERT INTO readings
       (camera_id, ts, online, cpu, memory, storage_used_gb, storage_total_gb,
        latency_ms, fault_flag, heartbeat_at)
     VALUES ($1, COALESCE($2, now()), $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      r.cameraId,
      at ?? null,
      r.online,
      r.cpu,
      r.memory,
      r.storageUsedGb,
      r.storageTotalGb,
      r.latencyMs,
      r.faultFlag,
      r.heartbeatAt,
    ],
  );
}

interface LatestRow {
  camera_id: string;
  name: string;
  ts: string;
  online: boolean;
  cpu: number;
  memory: number;
  storage_used_gb: number;
  storage_total_gb: number;
  latency_ms: number;
  fault_flag: boolean;
  heartbeat_at: string;
  active_alert_count: string;
}

/**
 * Latest reading per camera plus its active-alert count, in one query.
 * DISTINCT ON (camera_id) ... ORDER BY camera_id, ts DESC is the idiomatic
 * Postgres way to get "the newest row per group".
 */
export async function getLatestSnapshots(offlineSecs: number): Promise<CameraSnapshot[]> {
  const { rows } = await query<LatestRow>(
    `SELECT DISTINCT ON (r.camera_id)
        r.camera_id, c.name, r.ts, r.online, r.cpu, r.memory,
        r.storage_used_gb, r.storage_total_gb, r.latency_ms,
        r.fault_flag, r.heartbeat_at,
        (SELECT count(*) FROM alerts a
           WHERE a.camera_id = r.camera_id AND a.active) AS active_alert_count
     FROM readings r
     JOIN cameras c ON c.id = r.camera_id
     ORDER BY r.camera_id, r.ts DESC`,
  );

  const now = Date.now();
  return rows.map((row) => {
    const reading = rowToReading(row);
    const stale = (now - new Date(row.heartbeat_at).getTime()) / 1000 > offlineSecs;
    const activeAlertCount = Number(row.active_alert_count);
    const online = row.online && !stale;

    let status: CameraSnapshot['status'] = 'online';
    if (!online) status = 'offline';
    else if (activeAlertCount > 0) status = 'critical';

    return {
      cameraId: row.camera_id,
      name: row.name,
      status,
      online,
      cpu: reading.cpu,
      memory: reading.memory,
      storageUsedGb: reading.storageUsedGb,
      storageTotalGb: reading.storageTotalGb,
      storageUsedPct: Math.round(storageUsedPct(reading)),
      latencyMs: reading.latencyMs,
      faultFlag: reading.faultFlag,
      heartbeatAt: row.heartbeat_at,
      lastReadingAt: row.ts,
      activeAlertCount,
    };
  });
}

/** One camera's latest snapshot, or null if unknown. */
export async function getSnapshot(
  cameraId: string,
  offlineSecs: number,
): Promise<CameraSnapshot | null> {
  const all = await getLatestSnapshots(offlineSecs);
  return all.find((s) => s.cameraId === cameraId) ?? null;
}

const METRIC_COLUMN: Record<TrendMetric, string> = {
  cpu: 'cpu',
  memory: 'memory',
  latency: 'latency_ms',
  storage: '(storage_used_gb / NULLIF(storage_total_gb,0)) * 100',
};

/** Roughly how many points a trend chart needs; more than this is wasted bandwidth and render time. */
const TARGET_POINTS = 180;

/**
 * Time-series of one metric for one camera over the last `hours`, downsampled
 * to ~TARGET_POINTS by averaging within fixed-size time buckets. Raw readings
 * accumulate without bound as the simulator runs (one row per camera every
 * interval, forever) — without bucketing, a "24h chart" could mean tens of
 * thousands of rows and a multi-MB response. Bucketing keeps the payload (and
 * the chart render) fast regardless of how much history has piled up.
 */
export async function getHistory(
  cameraId: string,
  metric: TrendMetric,
  hours: number,
): Promise<TrendPoint[]> {
  const column = METRIC_COLUMN[metric];
  const bucketSeconds = Math.max(60, Math.round((hours * 3600) / TARGET_POINTS));
  const { rows } = await query<{ ts: string; value: number }>(
    `SELECT to_timestamp(floor(extract(epoch from ts) / $3) * $3) AS ts,
            avg(${column}) AS value
       FROM readings
      WHERE camera_id = $1 AND ts >= now() - ($2 || ' hours')::interval
      GROUP BY 1
      ORDER BY 1 ASC`,
    [cameraId, String(hours), bucketSeconds],
  );
  return rows.map((r) => ({ ts: r.ts, value: Number(r.value) }));
}

function rowToReading(row: LatestRow): CameraReadingInput {
  return {
    cameraId: row.camera_id,
    name: row.name,
    online: row.online,
    cpu: Number(row.cpu),
    memory: Number(row.memory),
    storageUsedGb: Number(row.storage_used_gb),
    storageTotalGb: Number(row.storage_total_gb),
    latencyMs: Number(row.latency_ms),
    faultFlag: row.fault_flag,
    heartbeatAt: row.heartbeat_at,
  };
}
