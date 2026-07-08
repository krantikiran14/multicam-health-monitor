import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { apiRouter } from './routes';
import { ValidationError } from './validation';
import { config } from './config';

/**
 * Builds the Express app. Kept separate from `index.ts` so tests can import the
 * app with Supertest without starting a real HTTP listener.
 */
export function createApp() {
  const app = express();
  app.use(cors()); // harmless in single-origin prod; convenient for local dev
  app.use(express.json());

  // Interactive API docs at /api/docs, driven by the OpenAPI spec.
  const openApiPath = join(__dirname, '..', '..', 'docs', 'openapi.yaml');
  if (existsSync(openApiPath)) {
    const spec = parseYaml(readFileSync(openApiPath, 'utf-8'));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
  }

  app.use('/api', apiRouter);

  // In production the API also serves the built Angular app (single origin).
  if (config.staticDir && existsSync(config.staticDir)) {
    app.use(express.static(config.staticDir));
    // SPA fallback: any non-API GET returns index.html so client routing works.
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(join(config.staticDir, 'index.html'));
    });
  }

  // Central error handler: ValidationError → 400, everything else → 500.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
