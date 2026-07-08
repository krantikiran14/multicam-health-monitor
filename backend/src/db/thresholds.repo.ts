import { query } from './pool';
import { defaultThresholds } from '../config';
import type { Thresholds } from '../../../shared/types';

/**
 * Thresholds are stored as key/value rows whose keys match the `Thresholds`
 * interface property names (cpuMaxPct, offlineSecs, ...). This repo converts
 * between the row shape and the typed object.
 */

const KEYS: (keyof Thresholds)[] = [
  'cpuMaxPct',
  'memoryMaxPct',
  'storageMaxPct',
  'latencyMaxMs',
  'offlineSecs',
];

export async function getThresholds(): Promise<Thresholds> {
  const { rows } = await query<{ key: string; value: number }>('SELECT key, value FROM thresholds');
  const map = new Map(rows.map((r) => [r.key, Number(r.value)]));
  // Fall back to defaults for any key not yet persisted.
  const result = { ...defaultThresholds };
  for (const key of KEYS) {
    if (map.has(key)) result[key] = map.get(key)!;
  }
  return result;
}

/**
 * Update one or more thresholds. Only known keys are accepted, so a bad request
 * body cannot write arbitrary rows.
 */
export async function updateThresholds(patch: Partial<Thresholds>): Promise<Thresholds> {
  for (const key of KEYS) {
    const value = patch[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Threshold "${key}" must be a finite number`);
    }
    await query(
      `INSERT INTO thresholds (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value],
    );
  }
  return getThresholds();
}
