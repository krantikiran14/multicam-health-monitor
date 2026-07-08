import { pool } from '../db/pool';
import { initDb } from '../db/init';
import { upsertCamera } from '../db/readings.repo';
import { createCameras, advance, toReading, type CameraState } from '../../../shared/camera-model';

/**
 * Backfills historical readings so the dashboard's trend charts have data at
 * submission time (the brief requires >= 24h of history). Run with `npm run seed`.
 *
 * Configurable via env: SEED_HOURS, SEED_INTERVAL_SECS, CAMERA_COUNT.
 * We generate one reading per camera per interval step, walking the same camera
 * model the live simulator uses, and bulk-insert them in chunks for speed.
 */

function numEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const HOURS = numEnv('SEED_HOURS', 26); // a little over 24h to be safe
const INTERVAL_SECS = numEnv('SEED_INTERVAL_SECS', 120);
const CAMERA_COUNT = Math.max(5, numEnv('CAMERA_COUNT', 10));
const FAULT_PROBABILITY = numEnv('FAULT_PROBABILITY', 0.02);

interface Row {
  cameraId: string;
  ts: Date;
  online: boolean;
  cpu: number;
  memory: number;
  storageUsedGb: number;
  storageTotalGb: number;
  latencyMs: number;
  faultFlag: boolean;
  heartbeatAt: string;
}

async function bulkInsert(rows: Row[]): Promise<void> {
  const CHUNK = 500; // 500 rows * 10 cols = 5000 params, well under the limit
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values: unknown[] = [];
    const tuples = chunk.map((r, j) => {
      const b = j * 10;
      values.push(
        r.cameraId, r.ts, r.online, r.cpu, r.memory,
        r.storageUsedGb, r.storageTotalGb, r.latencyMs, r.faultFlag, r.heartbeatAt,
      );
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10})`;
    });
    await pool.query(
      `INSERT INTO readings
         (camera_id, ts, online, cpu, memory, storage_used_gb, storage_total_gb,
          latency_ms, fault_flag, heartbeat_at)
       VALUES ${tuples.join(',')}`,
      values,
    );
  }
}

async function main(): Promise<void> {
  await initDb();

  let cameras = createCameras(CAMERA_COUNT);
  for (const c of cameras) await upsertCamera(c.cameraId, c.name);

  const now = Date.now();
  const start = now - HOURS * 3600 * 1000;
  const steps = Math.floor((now - start) / (INTERVAL_SECS * 1000));

  const rows: Row[] = [];
  for (let s = 0; s <= steps; s++) {
    const ts = new Date(start + s * INTERVAL_SECS * 1000);
    cameras = cameras.map((c: CameraState) => advance(c, FAULT_PROBABILITY));
    for (const c of cameras) {
      const reading = toReading(c, ts);
      rows.push({ ...reading, ts });
    }
  }

  await bulkInsert(rows);

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${rows.length} readings for ${cameras.length} cameras over ${HOURS}h ` +
      `(every ${INTERVAL_SECS}s).`,
  );
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
