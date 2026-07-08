import 'dotenv/config';
import { createCameras, advance, toReading, type CameraState } from '../../shared/camera-model';

/**
 * The camera simulator. It holds N in-memory camera states, and on every tick
 * evolves each one and POSTs its health reading to the backend — exactly how a
 * fleet of real cameras (or their gateway) would report in.
 *
 * Everything is configurable via environment variables, so changing the number
 * of cameras, the interval, or the fault rate needs no code change.
 */

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const CAMERA_COUNT = Math.max(5, numEnv('CAMERA_COUNT', 10));
const INTERVAL_MS = numEnv('REPORT_INTERVAL_MS', 30_000);
const FAULT_PROBABILITY = numEnv('FAULT_PROBABILITY', 0.02);
const BACKEND_URL = (process.env.BACKEND_URL ?? 'http://localhost:4000').replace(/\/$/, '');

let cameras: CameraState[] = createCameras(CAMERA_COUNT);

async function postReading(state: CameraState): Promise<boolean> {
  const body = toReading(state, new Date());
  try {
    const res = await fetch(`${BACKEND_URL}/api/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function tick(): Promise<void> {
  cameras = cameras.map((c) => advance(c, FAULT_PROBABILITY));
  const results = await Promise.all(cameras.map(postReading));
  const ok = results.filter(Boolean).length;
  const online = cameras.filter((c) => c.online).length;
  // eslint-disable-next-line no-console
  console.log(
    `[${new Date().toISOString()}] reported ${ok}/${cameras.length} cameras ` +
      `(${online} online) → ${BACKEND_URL}`,
  );
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(
    `Simulator: ${CAMERA_COUNT} cameras every ${INTERVAL_MS}ms, ` +
      `faultProbability=${FAULT_PROBABILITY}, backend=${BACKEND_URL}`,
  );
  await tick(); // report immediately on startup
  setInterval(tick, INTERVAL_MS);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Simulator fatal error:', err);
  process.exit(1);
});
