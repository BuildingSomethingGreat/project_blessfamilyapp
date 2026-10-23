/**
 * Netlify Functions entry: serves the whole API at /api/* from the same site as the PWA.
 * Bundled by `pnpm --filter @bless/api build:netlify` into apps/web/netlify/functions/api.mjs.
 */
import { config as appConfig } from './config.ts';
import { createApp } from './app.ts';
import { getStore } from './store/index.ts';
import { MemoryStore } from './store/memory.ts';
import { seedDemo } from './lib/seed.ts';
import { SEED_VERSION } from './lib/seed-data.ts';
import type { Services } from './lib/services.ts';

let ready: Promise<{ fetch: (req: Request, env?: unknown) => Response | Promise<Response>; services: Services }> | null = null;

export async function boot() {
  if (!ready) {
    ready = (async () => {
      const store = getStore();
      await store.init();
      if (store instanceof MemoryStore && appConfig.seedDemo) {
        if (!store.isEmpty && store.seedVersion !== SEED_VERSION) store.reset(SEED_VERSION);
        if (store.isEmpty) {
          store.reset(SEED_VERSION);
          await seedDemo(store);
        }
      }
      const { app, services } = createApp(store);
      return { fetch: app.fetch, services };
    })();
  }
  return ready;
}

export default async (req: Request, context: unknown) => {
  const { fetch } = await boot();
  // Also answer at the default function endpoint, in case a redirect sends traffic there.
  const url = new URL(req.url);
  if (url.pathname.startsWith('/.netlify/functions/api')) {
    url.pathname = url.pathname.replace('/.netlify/functions/api', '/api') || '/api';
    req = new Request(url, req);
  }
  return fetch(req, { context });
};

export const config = { path: ['/api', '/api/*'] };
