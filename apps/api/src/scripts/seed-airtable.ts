/** Seeds the Airtable base with settings + demo households. Run once: pnpm seed:airtable */
import { AirtableStore } from '../store/airtable.ts';
import { config } from '../config.ts';
import { seedDemo } from '../lib/seed.ts';
import { DEFAULT_SETTINGS } from '../store/types.ts';

const store = new AirtableStore(config.airtable.token, config.airtable.baseId);
await store.init();
await store.updateSettings(DEFAULT_SETTINGS);
if (process.argv.includes('--demo')) {
  if ((await store.listFamilies()).length) {
    console.log('Base already has families; skipping demo households.');
  } else await seedDemo(store);
}
console.log('Airtable seeded.');
