import { Router, type Request, type Response, type NextFunction } from 'express';
import { parseReading, ValidationError } from './validation';
import { ingestReading } from './services/ingest.service';
import { buildSummary } from './services/snapshot.service';
import { notifyChange } from './realtime';
import { getThresholds, updateThresholds } from './db/thresholds.repo';
import { getLatestSnapshots, getSnapshot, getHistory } from './db/readings.repo';
import { listAlerts, countActiveAlerts } from './db/alerts.repo';
import type { TrendMetric } from '../../shared/types';

/** Wraps an async handler so thrown errors reach Express's error middleware. */
function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

const VALID_METRICS: TrendMetric[] = ['cpu', 'memory', 'storage', 'latency'];

export const apiRouter = Router();

// Liveness probe used by Docker/loadbalancers and the deploy smoke test.
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Ingest one camera reading: persist, evaluate, open/resolve alerts.
apiRouter.post(
  '/ingest',
  wrap(async (req, res) => {
    const reading = parseReading(req.body);
    const result = await ingestReading(reading);
    notifyChange(); // push fresh state to connected dashboards over the WebSocket
    res.status(201).json(result);
  }),
);

// Latest snapshot + derived status for every camera.
apiRouter.get(
  '/cameras',
  wrap(async (_req, res) => {
    const { offlineSecs } = await getThresholds();
    res.json(await getLatestSnapshots(offlineSecs));
  }),
);

// One camera's latest snapshot.
apiRouter.get(
  '/cameras/:id',
  wrap(async (req, res) => {
    const { offlineSecs } = await getThresholds();
    const snapshot = await getSnapshot(req.params.id, offlineSecs);
    if (!snapshot) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }
    res.json(snapshot);
  }),
);

// Historical trend for one metric of one camera (default last 24h).
apiRouter.get(
  '/cameras/:id/history',
  wrap(async (req, res) => {
    const metric = String(req.query.metric ?? 'cpu') as TrendMetric;
    if (!VALID_METRICS.includes(metric)) {
      res.status(400).json({ error: `metric must be one of ${VALID_METRICS.join(', ')}` });
      return;
    }
    const hours = Math.min(Math.max(Number(req.query.hours ?? 24), 1), 168);
    res.json(await getHistory(req.params.id, metric, hours));
  }),
);

// Active alerts (default) or the full alert history with ?active=false.
apiRouter.get(
  '/alerts',
  wrap(async (req, res) => {
    const activeOnly = req.query.active !== 'false';
    res.json(await listAlerts(activeOnly));
  }),
);

// Aggregate numbers for the dashboard summary cards.
apiRouter.get(
  '/summary',
  wrap(async (_req, res) => {
    const { offlineSecs } = await getThresholds();
    const cameras = await getLatestSnapshots(offlineSecs);
    res.json(buildSummary(cameras, await countActiveAlerts()));
  }),
);

// Read the current thresholds.
apiRouter.get(
  '/thresholds',
  wrap(async (_req, res) => {
    res.json(await getThresholds());
  }),
);

// Update thresholds at runtime (no code change / redeploy needed).
apiRouter.put(
  '/thresholds',
  wrap(async (req, res) => {
    if (typeof req.body !== 'object' || req.body === null) {
      throw new ValidationError('Body must be a JSON object of threshold values');
    }
    res.json(await updateThresholds(req.body));
  }),
);
