import request from 'supertest';
import type { Express } from 'express';
import type { Pool } from 'pg';
import type { Alert, CameraSnapshot, Summary } from '../../shared/types';

/**
 * End-to-end API tests against a REAL Postgres. They run only when
 * TEST_DATABASE_URL is set; otherwise the whole suite is skipped so that
 * `npm test` still passes on a machine without a database.
 *
 * We point DATABASE_URL at the test DB and `require` the app afterwards, because
 * the pool reads its connection string at import time.
 */
const TEST_DB = process.env.TEST_DATABASE_URL;
const suite = TEST_DB ? describe : describe.skip;

function reading(overrides: Record<string, unknown> = {}) {
  return {
    cameraId: 'itest-cam',
    name: 'Integration Camera',
    online: true,
    cpu: 10,
    memory: 20,
    storageUsedGb: 50,
    storageTotalGb: 500,
    latencyMs: 30,
    faultFlag: false,
    heartbeatAt: new Date().toISOString(),
    ...overrides,
  };
}

suite('API integration', () => {
  let app: Express;
  let pool: Pool;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    const { createApp } = require('../src/app');
    ({ pool } = require('../src/db/pool'));
    const { initDb } = require('../src/db/init');
    await initDb();
    app = createApp();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM alerts');
    await pool.query('DELETE FROM readings');
    await pool.query('DELETE FROM cameras');
    // reset thresholds to defaults for a clean slate
    await pool.query("UPDATE thresholds SET value = 85 WHERE key = 'cpuMaxPct'");
  });

  afterAll(async () => {
    await pool.end();
  });

  it('health check responds ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('ingests a reading and reports the camera as online', async () => {
    await request(app).post('/api/ingest').send(reading()).expect(201);

    const res = await request(app).get('/api/cameras').expect(200);
    const cameras = res.body as CameraSnapshot[];
    expect(cameras).toHaveLength(1);
    expect(cameras[0]).toMatchObject({ cameraId: 'itest-cam', status: 'online' });
  });

  it('rejects an invalid ingest body with 400', async () => {
    await request(app).post('/api/ingest').send({ cameraId: 'x' }).expect(400);
  });

  it('opens an alert on breach and resolves it when cleared', async () => {
    // Breach CPU.
    await request(app).post('/api/ingest').send(reading({ cpu: 99 })).expect(201);
    let alerts = (await request(app).get('/api/alerts?active=true').expect(200))
      .body as Alert[];
    expect(alerts.map((a) => a.type)).toContain('cpu_high');

    // Clear it.
    await request(app).post('/api/ingest').send(reading({ cpu: 10 })).expect(201);
    alerts = (await request(app).get('/api/alerts?active=true').expect(200)).body as Alert[];
    expect(alerts.map((a) => a.type)).not.toContain('cpu_high');
  });

  it('summary reflects online percentage and active alerts', async () => {
    await request(app).post('/api/ingest').send(reading({ cpu: 99 })).expect(201);
    const summary = (await request(app).get('/api/summary').expect(200)).body as Summary;
    expect(summary.totalCameras).toBe(1);
    expect(summary.onlinePct).toBe(100);
    expect(summary.activeAlerts).toBeGreaterThanOrEqual(1);
  });

  it('honours a threshold changed at runtime (no code change)', async () => {
    await request(app).put('/api/thresholds').send({ cpuMaxPct: 5 }).expect(200);
    await request(app).post('/api/ingest').send(reading({ cpu: 20 })).expect(201);
    const alerts = (await request(app).get('/api/alerts?active=true').expect(200))
      .body as Alert[];
    expect(alerts.map((a) => a.type)).toContain('cpu_high');
  });

  it('returns historical trend points for a camera', async () => {
    await request(app).post('/api/ingest').send(reading({ cpu: 42 })).expect(201);
    const res = await request(app)
      .get('/api/cameras/itest-cam/history?metric=cpu&hours=24')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('value');
  });
});
