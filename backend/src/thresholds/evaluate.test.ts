import { evaluate, storageUsedPct, heartbeatAgeSecs } from './evaluate';
import type { CameraReadingInput, Thresholds } from '../../../shared/types';

/**
 * Flagship unit tests. `evaluate` is a pure function, so every rule and its
 * boundary can be checked with plain in-memory objects — no DB, no mocks.
 */

const NOW = new Date('2026-07-08T12:00:00.000Z');

const thresholds: Thresholds = {
  cpuMaxPct: 85,
  memoryMaxPct: 90,
  storageMaxPct: 90,
  latencyMaxMs: 250,
  offlineSecs: 120,
};

/** A perfectly healthy reading; tests override just the field under test. */
function healthy(overrides: Partial<CameraReadingInput> = {}): CameraReadingInput {
  return {
    cameraId: 'cam-01',
    name: 'Camera 01',
    online: true,
    cpu: 20,
    memory: 30,
    storageUsedGb: 100,
    storageTotalGb: 500, // 20% used
    latencyMs: 40,
    faultFlag: false,
    heartbeatAt: NOW.toISOString(),
    ...overrides,
  };
}

describe('helpers', () => {
  it('computes storage used percentage', () => {
    expect(storageUsedPct(healthy({ storageUsedGb: 90, storageTotalGb: 100 }))).toBe(90);
  });

  it('returns 0% storage when total is zero (no divide-by-zero)', () => {
    expect(storageUsedPct(healthy({ storageUsedGb: 5, storageTotalGb: 0 }))).toBe(0);
  });

  it('computes heartbeat age in seconds', () => {
    const r = healthy({ heartbeatAt: new Date(NOW.getTime() - 90_000).toISOString() });
    expect(heartbeatAgeSecs(r, NOW)).toBe(90);
  });
});

describe('evaluate — healthy reading', () => {
  it('returns no breaches for a fully healthy camera', () => {
    expect(evaluate(healthy(), thresholds, NOW)).toEqual([]);
  });
});

describe('evaluate — CPU', () => {
  it('does NOT breach exactly at the threshold (uses strictly greater-than)', () => {
    expect(evaluate(healthy({ cpu: 85 }), thresholds, NOW)).toEqual([]);
  });

  it('breaches one point above the threshold', () => {
    const breaches = evaluate(healthy({ cpu: 86 }), thresholds, NOW);
    expect(breaches).toHaveLength(1);
    expect(breaches[0]).toMatchObject({
      type: 'cpu_high',
      severity: 'warning',
      thresholdValue: 85,
      observedValue: 86,
    });
  });
});

describe('evaluate — memory', () => {
  it('breaches above the memory threshold as a warning', () => {
    const breaches = evaluate(healthy({ memory: 95 }), thresholds, NOW);
    expect(breaches).toHaveLength(1);
    expect(breaches[0]).toMatchObject({ type: 'memory_high', severity: 'warning' });
  });
});

describe('evaluate — storage', () => {
  it('does not breach exactly at 90% used', () => {
    const r = healthy({ storageUsedGb: 90, storageTotalGb: 100 });
    expect(evaluate(r, thresholds, NOW)).toEqual([]);
  });

  it('breaches above 90% used as critical', () => {
    const r = healthy({ storageUsedGb: 95, storageTotalGb: 100 });
    const breaches = evaluate(r, thresholds, NOW);
    expect(breaches).toHaveLength(1);
    expect(breaches[0]).toMatchObject({ type: 'storage_high', severity: 'critical' });
  });
});

describe('evaluate — latency', () => {
  it('breaches above the latency threshold', () => {
    const breaches = evaluate(healthy({ latencyMs: 300 }), thresholds, NOW);
    expect(breaches.map((b) => b.type)).toContain('latency_high');
  });
});

describe('evaluate — fault flag', () => {
  it('raises a critical fault breach when faultFlag is set', () => {
    const breaches = evaluate(healthy({ faultFlag: true }), thresholds, NOW);
    expect(breaches).toHaveLength(1);
    expect(breaches[0]).toMatchObject({ type: 'fault', severity: 'critical' });
  });
});

describe('evaluate — offline / stale', () => {
  it('raises offline when the camera reports online=false', () => {
    const breaches = evaluate(healthy({ online: false }), thresholds, NOW);
    expect(breaches).toHaveLength(1);
    expect(breaches[0]).toMatchObject({ type: 'offline', severity: 'critical' });
  });

  it('raises offline when the heartbeat is older than offlineSecs', () => {
    const stale = healthy({
      heartbeatAt: new Date(NOW.getTime() - 121_000).toISOString(),
    });
    const breaches = evaluate(stale, thresholds, NOW);
    expect(breaches).toHaveLength(1);
    expect(breaches[0].type).toBe('offline');
  });

  it('does NOT raise offline exactly at the heartbeat boundary', () => {
    const boundary = healthy({
      heartbeatAt: new Date(NOW.getTime() - 120_000).toISOString(),
    });
    expect(evaluate(boundary, thresholds, NOW)).toEqual([]);
  });

  it('suppresses metric breaches when offline (only offline is reported)', () => {
    // CPU + storage would both breach, but the camera is offline.
    const r = healthy({ online: false, cpu: 99, storageUsedGb: 99, storageTotalGb: 100 });
    const breaches = evaluate(r, thresholds, NOW);
    expect(breaches).toHaveLength(1);
    expect(breaches[0].type).toBe('offline');
  });
});

describe('evaluate — multiple simultaneous breaches', () => {
  it('reports every breached metric for an online camera', () => {
    const r = healthy({
      cpu: 99,
      memory: 99,
      latencyMs: 999,
      storageUsedGb: 99,
      storageTotalGb: 100,
      faultFlag: true,
    });
    const types = evaluate(r, thresholds, NOW).map((b) => b.type).sort();
    expect(types).toEqual(
      ['cpu_high', 'fault', 'latency_high', 'memory_high', 'storage_high'].sort(),
    );
  });
});

describe('evaluate — thresholds are configurable', () => {
  it('respects a lowered CPU threshold (proves runtime-configurability)', () => {
    const strict: Thresholds = { ...thresholds, cpuMaxPct: 10 };
    const breaches = evaluate(healthy({ cpu: 20 }), strict, NOW);
    expect(breaches.map((b) => b.type)).toContain('cpu_high');
  });
});
