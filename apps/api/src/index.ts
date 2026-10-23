import { serve } from '@hono/node-server';
import { config } from './config.ts';
import { createApp } from './app.ts';
import { getStore } from './store/index.ts';
import { MemoryStore } from './store/memory.ts';
import { seedDemo } from './lib/seed.ts';
import { SEED_VERSION } from './lib/seed-data.ts';
import { startScheduler } from './followup/engine.ts';

const store = getStore();
await store.init();
if (store instanceof MemoryStore && config.seedDemo) {
  if (!store.isEmpty && store.seedVersion !== SEED_VERSION) {
    console.log(`[seed] demo data is from an older seed (${store.seedVersion || 'unversioned'}); reloading`);
    store.reset(SEED_VERSION);
  }
  if (store.isEmpty) {
    store.reset(SEED_VERSION);
    await seedDemo(store);
  }
}

const { app, services } = createApp(store);
startScheduler(services.followUp);

serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (info) => {
  console.log(`bless-a-family api on http://localhost:${info.port} (store=${store.kind}, notify=${config.notify.driver}, agent=${config.anthropic.apiKey ? 'on' : 'off'})`);
});
