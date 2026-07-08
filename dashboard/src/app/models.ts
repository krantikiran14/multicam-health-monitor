/**
 * Frontend view of the API contract. These mirror the backend's shared types.
 * Kept as a small local file so the Angular build stays self-contained.
 */

export type CameraStatus = 'online' | 'offline' | 'critical';

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

export type AlertType =
  | 'cpu_high'
  | 'memory_high'
  | 'storage_high'
  | 'latency_high'
  | 'offline'
  | 'fault';

export type AlertSeverity = 'warning' | 'critical';

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

export interface Thresholds {
  cpuMaxPct: number;
  memoryMaxPct: number;
  storageMaxPct: number;
  latencyMaxMs: number;
  offlineSecs: number;
}

export interface Summary {
  totalCameras: number;
  onlineCameras: number;
  offlineCameras: number;
  criticalCameras: number;
  onlinePct: number;
  activeAlerts: number;
}

export interface TrendPoint {
  ts: string;
  value: number;
}

/** Full live state pushed over the WebSocket on every change. */
export interface LiveSnapshot {
  summary: Summary;
  cameras: CameraSnapshot[];
  alerts: Alert[];
  ts: string;
}

export type TrendMetric = 'cpu' | 'memory' | 'storage' | 'latency';
