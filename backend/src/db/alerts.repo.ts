import { query } from './pool';
import type { Alert } from '../../../shared/types';
import type { Breach } from '../thresholds/evaluate';
import type { OpenAlertRef } from '../alerts/reconcile';
import type { AlertType } from '../../../shared/types';

/** All currently-open alerts for one camera (used by the reconcile step). */
export async function getOpenAlerts(cameraId: string): Promise<OpenAlertRef[]> {
  const { rows } = await query<{ type: AlertType }>(
    `SELECT type FROM alerts WHERE camera_id = $1 AND active`,
    [cameraId],
  );
  return rows;
}

/** Insert a new active alert for a breach. */
export async function openAlert(cameraId: string, breach: Breach): Promise<void> {
  await query(
    `INSERT INTO alerts
       (camera_id, type, severity, message, threshold_value, observed_value, active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     ON CONFLICT (camera_id, type) WHERE active DO NOTHING`,
    [cameraId, breach.type, breach.severity, breach.message, breach.thresholdValue, breach.observedValue],
  );
}

/** Resolve the active alert of a given type for a camera. */
export async function resolveAlert(cameraId: string, type: AlertType): Promise<void> {
  await query(
    `UPDATE alerts SET active = false, resolved_at = now()
      WHERE camera_id = $1 AND type = $2 AND active`,
    [cameraId, type],
  );
}

interface AlertRow {
  id: string;
  camera_id: string;
  name: string;
  type: AlertType;
  severity: 'warning' | 'critical';
  message: string;
  threshold_value: number | null;
  observed_value: number | null;
  opened_at: string;
  resolved_at: string | null;
  active: boolean;
}

/** List alerts, newest first. `activeOnly` restricts to open alerts. */
export async function listAlerts(activeOnly: boolean): Promise<Alert[]> {
  const { rows } = await query<AlertRow>(
    `SELECT a.id, a.camera_id, c.name, a.type, a.severity, a.message,
            a.threshold_value, a.observed_value, a.opened_at, a.resolved_at, a.active
       FROM alerts a
       JOIN cameras c ON c.id = a.camera_id
      ${activeOnly ? 'WHERE a.active' : ''}
      ORDER BY a.opened_at DESC
      LIMIT 500`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    cameraId: r.camera_id,
    cameraName: r.name,
    type: r.type,
    severity: r.severity,
    message: r.message,
    thresholdValue: r.threshold_value === null ? null : Number(r.threshold_value),
    observedValue: r.observed_value === null ? null : Number(r.observed_value),
    openedAt: r.opened_at,
    resolvedAt: r.resolved_at,
    active: r.active,
  }));
}

/** Count of active alerts across all cameras. */
export async function countActiveAlerts(): Promise<number> {
  const { rows } = await query<{ count: string }>(`SELECT count(*) FROM alerts WHERE active`);
  return Number(rows[0].count);
}
