import { Server as IOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { buildSnapshot } from './services/snapshot.service';

/**
 * WebSocket layer (Socket.IO). The dashboard connects once and receives a
 * `snapshot` event whenever the data changes — instead of polling the REST API.
 *
 * Two triggers push a snapshot:
 *   1. `notifyChange()` — called right after an ingest (debounced, so the burst
 *      of ~10 readings per tick collapses into a single broadcast).
 *   2. a periodic timer — so "offline for > N seconds" is detected and pushed
 *      even when a silent camera sends nothing.
 * New clients also get the current snapshot immediately on connect.
 */

let io: IOServer | null = null;
let pending = false;
let periodic: ReturnType<typeof setInterval> | null = null;

export function initRealtime(server: HttpServer): void {
  io = new IOServer(server, { cors: { origin: '*' } });

  io.on('connection', async (socket) => {
    socket.emit('snapshot', await buildSnapshot());
  });

  // Keep offline/stale status fresh without any client action.
  periodic = setInterval(() => void broadcast(), 10_000);
}

async function broadcast(): Promise<void> {
  if (!io) return;
  io.emit('snapshot', await buildSnapshot());
}

/** Request a broadcast after a change. Debounced to collapse ingest bursts. */
export function notifyChange(): void {
  if (!io || pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    void broadcast();
  }, 300);
}

/** Stop timers and close the server (used by tests for a clean shutdown). */
export async function closeRealtime(): Promise<void> {
  if (periodic) clearInterval(periodic);
  periodic = null;
  if (io) await io.close();
  io = null;
}
