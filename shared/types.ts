/**
 * Shared TypeScript types used by both the backend and the simulator.
 *
 * Keeping these in one place means the "contract" between a camera (simulator)
 * and the API (backend) is defined exactly once. Both projects import this file
 * with a relative path; it is copied into each Docker image at build time.
 */

/** The health payload a single camera POSTs to `/api/ingest` on every tick. */
export interface CameraReadingInput {
  cameraId: string;
  name: string;
  online: boolean;
  cpu: number; // percent, 0-100
  memory: number; // percent, 0-100
  storageUsedGb: number;
  storageTotalGb: number;
  latencyMs: number;
  faultFlag: boolean;
  /** ISO timestamp of the camera's last heartbeat. */
  heartbeatAt: string;
}

/** A stored reading as returned by the API (includes server-side fields). */
export interface CameraReading extends CameraReadingInput {
  id: number;
  ts: string; // ISO timestamp the backend recorded the reading
}

/** Derived status shown on the dashboard for each camera. */
export type CameraStatus = 'online' | 'offline' | 'critical';

/** Latest snapshot of a camera plus its derived status. */
export interface CameraSnapshot {
  cameraId: string;
  name: string;
  status: CameraStatus;
  online: boolean;
  cpu: number;
  memory: number;
  storageUsedGb: number;
  storageTotalGb: number;
  storageUsedPct: number;
  latencyMs: number;
  faultFlag: boolean;
  heartbeatAt: string;
  lastReadingAt: string;
  activeAlertCount: number;
}

/** The kinds of threshold breaches we detect. */
export type AlertType =
  | 'cpu_high'
  | 'memory_high'
  | 'storage_high'
  | 'latency_high'
  | 'offline'
  | 'fault';

export type AlertSeverity = 'warning' | 'critical';

/** A failure event recorded when a threshold is breached. */
export interface Alert {
  id: number;
  cameraId: string;
  cameraName: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  thresholdValue: number | null;
  observedValue: number | null;
  openedAt: string;
  resolvedAt: string | null;
  active: boolean;
}

/** Configurable health thresholds — editable at runtime, no code change needed. */
export interface Thresholds {
  cpuMaxPct: number;
  memoryMaxPct: number;
  storageMaxPct: number;
  latencyMaxMs: number;
  offlineSecs: number;
}

/** Aggregate numbers for the dashboard summary cards. */
export interface Summary {
  totalCameras: number;
  onlineCameras: number;
  offlineCameras: number;
  criticalCameras: number;
  onlinePct: number;
  activeAlerts: number;
}

/**
 * The full live state pushed to dashboards over the WebSocket on every change.
 * One message carries everything the overview and alerts views need.
 */
export interface LiveSnapshot {
  summary: Summary;
  cameras: CameraSnapshot[];
  alerts: Alert[];
  ts: string;
}

/** A single point in a historical trend series. */
export interface TrendPoint {
  ts: string;
  value: number;
}

/** The metrics that can be charted over time. */
export type TrendMetric = 'cpu' | 'memory' | 'storage' | 'latency';
