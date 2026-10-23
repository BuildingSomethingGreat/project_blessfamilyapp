import { config } from '../config.ts';
import { AirtableStore } from './airtable.ts';
import { MemoryStore } from './memory.ts';
import type { Store } from './types.ts';

let instance: Store | null = null;

export function createStore(): Store {
  if (config.store === 'airtable') {
    if (config.airtable.token) return new AirtableStore(config.airtable.token, config.airtable.baseId);
    console.warn('[store] STORE=airtable but AIRTABLE_TOKEN is missing; falling back to the in-memory demo store');
  }
  return new MemoryStore(config.isNetlify ? '/tmp/bless-a-family' : config.dataDir);
}

export function getStore(): Store {
  if (!instance) instance = createStore();
  return instance;
}

export function setStore(s: Store) {
  instance = s;
}

export type { Store } from './types.ts';
