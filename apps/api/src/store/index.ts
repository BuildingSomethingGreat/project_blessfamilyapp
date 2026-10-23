import { config } from '../config.ts';
import { AirtableStore } from './airtable.ts';
import { MemoryStore } from './memory.ts';
import type { Store } from './types.ts';

let instance: Store | null = null;

export function createStore(): Store {
  if (config.store === 'airtable') return new AirtableStore(config.airtable.token, config.airtable.baseId);
  return new MemoryStore(config.dataDir);
}

export function getStore(): Store {
  if (!instance) instance = createStore();
  return instance;
}

export function setStore(s: Store) {
  instance = s;
}

export type { Store } from './types.ts';
