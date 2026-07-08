import type { CameraReadingInput } from './types';

/**
 * Pure camera-simulation model, shared by the live simulator and the history
 * seed script so both produce the same kind of realistic data. No I/O here —
 * just math — which keeps it trivial to reason about and reuse.
 */

export interface CameraState {
  cameraId: string;
  name: string;
  online: boolean;
  cpu: number;
  memory: number;
  latencyMs: number;
  storageUsedGb: number;
  storageTotalGb: number;
  faultFlag: boolean;
  // Per-camera baselines the metrics gently revert toward (mean reversion).
  cpuBase: number;
  memBase: number;
  latBase: number;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Build the initial state for `count` cameras (min 1). */
export function createCameras(count: number): CameraState[] {
  const cameras: CameraState[] = [];
  for (let i = 1; i <= Math.max(1, count); i++) {
    const totalGb = [256, 512, 1024][i % 3];
    const cpuBase = rand(25, 70);
    const memBase = rand(30, 75);
    const latBase = rand(20, 120);
    cameras.push({
      cameraId: `cam-${pad(i)}`,
      name: `Camera ${pad(i)}`,
      online: true,
      cpu: cpuBase,
      memory: memBase,
      latencyMs: latBase,
      storageUsedGb: totalGb * rand(0.3, 0.72),
      storageTotalGb: totalGb,
      faultFlag: false,
      cpuBase,
      memBase,
      latBase,
    });
  }
  return cameras;
}

/**
 * Advance a camera one tick: mean-reverting random walk with occasional spikes,
 * slow storage growth, and low-probability faults/offline events. Returns a new
 * state object (does not mutate the input).
 */
export function advance(state: CameraState, faultProbability: number): CameraState {
  const walk = (v: number, base: number, noise: number) =>
    v + (base - v) * 0.1 + rand(-noise, noise);

  let cpu = clamp(walk(state.cpu, state.cpuBase, 6), 1, 100);
  let memory = clamp(walk(state.memory, state.memBase, 5), 1, 100);
  let latencyMs = clamp(walk(state.latencyMs, state.latBase, 12), 3, 500);

  // Occasional spikes so alerts actually fire during a demo.
  if (Math.random() < 0.03) cpu = rand(88, 99);
  if (Math.random() < 0.02) memory = rand(92, 99);
  if (Math.random() < 0.02) latencyMs = rand(280, 460);

  // Storage only grows, slowly, until the disk is full.
  const storageUsedGb = clamp(
    state.storageUsedGb + rand(0, state.storageTotalGb * 0.0002),
    0,
    state.storageTotalGb,
  );

  const faultFlag = Math.random() < faultProbability;
  const online = Math.random() >= faultProbability * 0.5;

  return { ...state, cpu, memory, latencyMs, storageUsedGb, faultFlag, online };
}

/** Convert a camera state into the wire payload sent to `/api/ingest`. */
export function toReading(state: CameraState, heartbeatAt: Date): CameraReadingInput {
  const round = (n: number, dp = 1) => Number(n.toFixed(dp));
  return {
    cameraId: state.cameraId,
    name: state.name,
    online: state.online,
    cpu: round(state.cpu),
    memory: round(state.memory),
    storageUsedGb: round(state.storageUsedGb, 2),
    storageTotalGb: state.storageTotalGb,
    latencyMs: round(state.latencyMs),
    faultFlag: state.faultFlag,
    heartbeatAt: heartbeatAt.toISOString(),
  };
}
