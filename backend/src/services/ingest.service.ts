import type { CameraReadingInput } from '../../../shared/types';
import { evaluate } from '../thresholds/evaluate';
import { reconcile } from '../alerts/reconcile';
import { getThresholds } from '../db/thresholds.repo';
import { upsertCamera, insertReading } from '../db/readings.repo';
import { getOpenAlerts, openAlert, resolveAlert } from '../db/alerts.repo';

/**
 * Orchestrates a single ingest: persist the reading, evaluate it against the
 * current thresholds, then open/resolve alerts accordingly. This is the one
 * place that wires the pure functions (`evaluate`, `reconcile`) to the database.
 */
export async function ingestReading(
  input: CameraReadingInput,
  now: Date = new Date(),
): Promise<{ breaches: number; opened: number; resolved: number }> {
  await upsertCamera(input.cameraId, input.name);
  await insertReading(input);

  const thresholds = await getThresholds();
  const breaches = evaluate(input, thresholds, now);

  const openAlerts = await getOpenAlerts(input.cameraId);
  const { toOpen, toResolve } = reconcile(breaches, openAlerts);

  for (const breach of toOpen) await openAlert(input.cameraId, breach);
  for (const type of toResolve) await resolveAlert(input.cameraId, type);

  return { breaches: breaches.length, opened: toOpen.length, resolved: toResolve.length };
}
