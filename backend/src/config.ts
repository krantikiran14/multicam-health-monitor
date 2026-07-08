import 'dotenv/config';
import type { Thresholds } from '../../shared/types';

/**
 * Central place that reads environment variables once and exposes typed config.
 * Nothing else in the app touches `process.env` directly.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num('PORT', 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://atri:atri@localhost:5432/atri',
  /** When set, the API serves the built Angular app from this directory. */
  staticDir: process.env.STATIC_DIR ?? '',
};

/** Default thresholds used to seed the DB on first boot. */
export const defaultThresholds: Thresholds = {
  cpuMaxPct: num('CPU_MAX_PCT', 85),
  memoryMaxPct: num('MEMORY_MAX_PCT', 90),
  storageMaxPct: num('STORAGE_MAX_PCT', 90),
  latencyMaxMs: num('LATENCY_MAX_MS', 250),
  offlineSecs: num('OFFLINE_SECS', 120),
};
