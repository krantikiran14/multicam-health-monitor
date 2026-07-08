import type { Server as HttpServer } from 'node:http';
import type { Pool } from 'pg';
import type { Socket } from 'socket.io-client';
import type { LiveSnapshot } from '../../shared/types';

/**
 * WebSocket (Socket.IO) integration test against a real Postgres + a real HTTP
 * server. Skips itself when TEST_DATABASE_URL is unset. Verifies that a client
 * gets a snapshot on connect and another one after an ingest.
 */
const TEST_DB = process.env.TEST_DATABASE_URL;
const suite = TEST_DB ? describe : describe.skip;

function reading(overrides: Record<string, unknown> = {}) {
  return {
    cameraId: 'ws-cam', name: 'WS Camera', online: true, cpu: 10, memory: 20,
    storageUsedGb: 50, storageTotalGb: 500, latencyMs: 30, faultFlag: false,
    heartbeatAt: new Date().toISOString(), ...overrides,
  };
}

suite('realtime (socket.io)', () => {
  let server: HttpServer;
  let pool: Pool;
  let client: Socket;
  let port: number;
  let firstSnapshot: LiveSnapshot;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    const { createApp } = require('../src/app');
    ({ pool } = require('../src/db/pool'));
    const { initDb } = require('../src/db/init');
    const { initRealtime } = require('../src/realtime');
    await initDb();

    const app = createApp();
    await new Promise<void>((res) => {
      server = app.listen(0, res);
    });
    port = (server.address() as { port: number }).port;
    initRealtime(server);

    const { io } = require('socket.io-client');
    client = io(`http://localhost:${port}`, { transports: ['websocket'] });
    firstSnapshot = await new Promise<LiveSnapshot>((res) =>
      client.once('snapshot', (s: LiveSnapshot) => res(s)),
    );
  });

  afterAll(async () => {
    const { closeRealtime } = require('../src/realtime');
    client?.close();
    await closeRealtime();
    await new Promise<void>((res) => server.close(() => res()));
    await pool.end();
  });

  it('sends a snapshot on connect', () => {
    expect(firstSnapshot).toHaveProperty('summary');
    expect(firstSnapshot).toHaveProperty('alerts');
    expect(Array.isArray(firstSnapshot.cameras)).toBe(true);
  });

  it('pushes a new snapshot after an ingest', async () => {
    const next = new Promise<LiveSnapshot>((res) =>
      client.once('snapshot', (s: LiveSnapshot) => res(s)),
    );
    await fetch(`http://localhost:${port}/api/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(reading({ cpu: 42 })),
    });
    const snap = await next;
    expect(snap.cameras.some((c) => c.cameraId === 'ws-cam')).toBe(true);
  }, 5000);
});
