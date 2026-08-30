import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import client from 'prom-client';
import { swaggerMiddleware, swaggerSetup } from './swagger';
import { router } from './routes';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export function createApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      skip: (req) => req.path === '/metrics' || req.path === '/health',
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.use('/api-docs', swaggerMiddleware, swaggerSetup);
  app.use(router);

  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error(err);
      res.status(500).json({ error: err.message });
    },
  );
  return app;
}
