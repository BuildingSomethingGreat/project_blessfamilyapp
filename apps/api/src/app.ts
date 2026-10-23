import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { ZodError } from 'zod';
import { config } from './config.ts';
import { Services, HttpError } from './lib/services.ts';
import { adminRoutes } from './routes/admin.ts';
import { publicRoutes } from './routes/public.ts';
import { sponsorRoutes } from './routes/sponsor.ts';
import type { Store } from './store/types.ts';

export function createApp(store: Store) {
  const services = new Services(store);
  const app = new Hono();
  app.use('*', secureHeaders());
  if (!config.isProd) app.use('*', logger());
  app.use('/api/*', cors({ origin: (o) => (config.corsOrigins.includes(o) ? o : config.corsOrigins[0]), credentials: true }));

  app.get('/', (c) => c.json({ name: 'bless-a-family-api', ok: true }));
  app.get('/healthz', (c) => c.json({ ok: true, store: store.kind, time: new Date().toISOString() }));
  app.route('/api', publicRoutes(services));
  app.route('/api/sponsor', sponsorRoutes(services));
  app.route('/api/admin', adminRoutes(services));

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status as any);
    if (err instanceof ZodError) return c.json({ error: 'Invalid input', issues: err.flatten() }, 400);
    console.error(err);
    return c.json({ error: 'Something went wrong on our side.' }, 500);
  });
  return { app, services };
}
