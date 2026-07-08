import type { CameraSnapshot, LiveSnapshot, Summary } from '../../../shared/types';
import { getThresholds } from '../db/thresholds.repo';
import { getLatestSnapshots } from '../db/readings.repo';
import { listAlerts, countActiveAlerts } from '../db/alerts.repo';

/** Derive the summary-card numbers from a set of camera snapshots. */
export function buildSummary(cameras: CameraSnapshot[], activeAlerts: number): Summary {
  const online = cameras.filter((c) => c.online).length;
  const critical = cameras.filter((c) => c.status === 'critical').length;
  return {
    totalCameras: cameras.length,
    onlineCameras: online,
    offlineCameras: cameras.length - online,
    criticalCameras: critical,
    onlinePct: cameras.length === 0 ? 0 : Math.round((online / cameras.length) * 100),
    activeAlerts,
  };
}

/**
 * Build the full live snapshot pushed over the WebSocket: current camera
 * status, the summary, and active alerts — everything the dashboard's overview
 * and alerts views need, in one payload.
 */
export async function buildSnapshot(): Promise<LiveSnapshot> {
  const { offlineSecs } = await getThresholds();
  const cameras = await getLatestSnapshots(offlineSecs);
  const activeAlerts = await countActiveAlerts();
  return {
    summary: buildSummary(cameras, activeAlerts),
    cameras,
    alerts: await listAlerts(true),
    ts: new Date().toISOString(),
  };
}
