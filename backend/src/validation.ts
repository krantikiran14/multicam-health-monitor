import type { CameraReadingInput } from '../../shared/types';

/** Thrown for a 400 Bad Request; caught by the error handler in app.ts. */
export class ValidationError extends Error {}

function requireNumber(body: Record<string, unknown>, field: string): number {
  const value = body[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`Field "${field}" must be a number`);
  }
  return value;
}

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`Field "${field}" must be a non-empty string`);
  }
  return value;
}

function requireBoolean(body: Record<string, unknown>, field: string): boolean {
  const value = body[field];
  if (typeof value !== 'boolean') {
    throw new ValidationError(`Field "${field}" must be a boolean`);
  }
  return value;
}

/** Validate and normalise a `/api/ingest` request body into a typed reading. */
export function parseReading(body: unknown): CameraReadingInput {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('Request body must be a JSON object');
  }
  const b = body as Record<string, unknown>;
  return {
    cameraId: requireString(b, 'cameraId'),
    name: requireString(b, 'name'),
    online: requireBoolean(b, 'online'),
    cpu: requireNumber(b, 'cpu'),
    memory: requireNumber(b, 'memory'),
    storageUsedGb: requireNumber(b, 'storageUsedGb'),
    storageTotalGb: requireNumber(b, 'storageTotalGb'),
    latencyMs: requireNumber(b, 'latencyMs'),
    faultFlag: requireBoolean(b, 'faultFlag'),
    heartbeatAt: requireString(b, 'heartbeatAt'),
  };
}
