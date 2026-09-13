import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import client from 'prom-client';
import { config } from './config';
import { swaggerMiddleware, swaggerSetup } from './swagger';
import { router } from './routes';
import { traducirError } from './errors';
import { peersLevantados } from './fabric';

function corsOrigins(): string[] {
  const base = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  for (const o of config.corsOrigin.split(',')) {
    const t = o.trim();
    if (t && !base.includes(t)) {
      base.push(t);
    }
  }
  return base;
}

function originPermitido(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  if (corsOrigins().includes(origin)) {
    return true;
  }
  try {
    const u = new URL(origin);
    return u.protocol === 'https:' && u.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export function createApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (originPermitido(origin)) {
          cb(null, true);
          return;
        }
        cb(new Error('Origen CORS no permitido'));
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 600,
      skip: (req) =>
        req.path === '/metrics' ||
        req.path === '/health' ||
        req.path === '/red' ||
        req.path === '/auth/login' ||
        req.path === '/explorer',
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/red', async (_req, res) => {
    res.json({ peers: await peersLevantados() });
  });

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.use('/api-docs', swaggerMiddleware, swaggerSetup);
  app.use(router);

  app.use(
    (err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error(err);
      const { status, body } = traducirError(err, {
        org: req.user?.org,
        ruta: req.path,
        lote: req.loteContexto ?? (req.body as { lote?: unknown } | undefined)?.lote,
      });
      res.status(status).json(body);
    },
  );
  return app;
}
