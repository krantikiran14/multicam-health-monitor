import type {
  AlertSeverity,
  AlertType,
  CameraReadingInput,
  Thresholds,
} from '../../../shared/types';

/**
 * A single detected threshold breach. The engine returns a list of these; the
 * alert-reconcile step turns them into opened/resolved alert rows.
 */
export interface Breach {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  thresholdValue: number | null;
  observedValue: number | null;
}

/** Storage used as a percentage of total. Guards against divide-by-zero. */
export function storageUsedPct(reading: CameraReadingInput): number {
  if (reading.storageTotalGb <= 0) return 0;
  return (reading.storageUsedGb / reading.storageTotalGb) * 100;
}

/** Age of the camera's last heartbeat in seconds, relative to `now`. */
export function heartbeatAgeSecs(reading: CameraReadingInput, now: Date): number {
  const beat = new Date(reading.heartbeatAt).getTime();
  return (now.getTime() - beat) / 1000;
}

/**
 * The heart of the system: given one camera reading and the active thresholds,
 * return every threshold that is currently breached. This function is PURE —
 * no database, no clock except the `now` you pass in — which is exactly why it
 * is easy to unit-test exhaustively.
 *
 * Rule: an offline camera only raises an `offline` breach. Its other metrics are
 * considered stale and are not evaluated.
 */
export function evaluate(
  reading: CameraReadingInput,
  thresholds: Thresholds,
  now: Date,
): Breach[] {
  const breaches: Breach[] = [];

  const stale = heartbeatAgeSecs(reading, now) > thresholds.offlineSecs;
  if (!reading.online || stale) {
    breaches.push({
      type: 'offline',
      severity: 'critical',
      message: reading.online
        ? `No heartbeat for over ${thresholds.offlineSecs}s`
        : 'Camera reported offline',
      thresholdValue: thresholds.offlineSecs,
      observedValue: Math.round(heartbeatAgeSecs(reading, now)),
    });
    return breaches; // stale/offline: skip metric checks
  }

  if (reading.faultFlag) {
    breaches.push({
      type: 'fault',
      severity: 'critical',
      message: 'Camera reported a hardware/software fault',
      thresholdValue: null,
      observedValue: null,
    });
  }

  if (reading.cpu > thresholds.cpuMaxPct) {
    breaches.push({
      type: 'cpu_high',
      severity: 'warning',
      message: `CPU ${reading.cpu.toFixed(0)}% over ${thresholds.cpuMaxPct}%`,
      thresholdValue: thresholds.cpuMaxPct,
      observedValue: reading.cpu,
    });
  }

  if (reading.memory > thresholds.memoryMaxPct) {
    breaches.push({
      type: 'memory_high',
      severity: 'warning',
      message: `Memory ${reading.memory.toFixed(0)}% over ${thresholds.memoryMaxPct}%`,
      thresholdValue: thresholds.memoryMaxPct,
      observedValue: reading.memory,
    });
  }

  const storagePct = storageUsedPct(reading);
  if (storagePct > thresholds.storageMaxPct) {
    breaches.push({
      type: 'storage_high',
      severity: 'critical',
      message: `Storage ${storagePct.toFixed(0)}% used over ${thresholds.storageMaxPct}%`,
      thresholdValue: thresholds.storageMaxPct,
      observedValue: Math.round(storagePct),
    });
  }

  if (reading.latencyMs > thresholds.latencyMaxMs) {
    breaches.push({
      type: 'latency_high',
      severity: 'warning',
      message: `Latency ${reading.latencyMs.toFixed(0)}ms over ${thresholds.latencyMaxMs}ms`,
      thresholdValue: thresholds.latencyMaxMs,
      observedValue: reading.latencyMs,
    });
  }

  return breaches;
}
