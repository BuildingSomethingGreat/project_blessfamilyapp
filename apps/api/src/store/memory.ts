import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Activity, Family, FamilyStatus, SeasonSettings, Sponsor, Sponsorship, SponsorshipStatus } from '@bless/shared';
import { DEFAULT_SETTINGS, type ActivityFilter, type NewActivity, type NewFamily, type NewSponsor, type NewSponsorship, type Store } from './types.ts';
import { nowIso, uuid } from '../lib/ids.ts';

interface Snapshot {
  families: Family[];
  sponsors: Sponsor[];
  sponsorships: Sponsorship[];
  activity: Activity[];
  settings: SeasonSettings;
}

/**
 * In-memory store with JSON persistence. Used for local dev, tests and demos.
 * Swap for AirtableStore (or a future Supabase store) via STORE env.
 */
export class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  private data: Snapshot = { families: [], sponsors: [], sponsorships: [], activity: [], settings: { ...DEFAULT_SETTINGS } };
  private file: string | null;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(dataDir: string | null) {
    this.file = dataDir ? path.join(dataDir, 'store.json') : null;
  }

  async init() {
    if (!this.file) return;
    try {
      const raw = await readFile(this.file, 'utf8');
      this.data = { ...this.data, ...JSON.parse(raw) };
    } catch {
      /* fresh */
    }
  }

  private persist() {
    if (!this.file) return;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      try {
        await mkdir(path.dirname(this.file!), { recursive: true });
        await writeFile(this.file!, JSON.stringify(this.data, null, 2));
      } catch (e) {
        console.error('persist failed', e);
      }
    }, 250);
  }

  get isEmpty() {
    return this.data.families.length === 0;
  }

  private clone<T>(x: T): T {
    return structuredClone(x);
  }

  async listFamilies(filter: { season?: string; status?: FamilyStatus[] } = {}) {
    return this.clone(
      this.data.families.filter((f) => (!filter.season || f.season === filter.season) && (!filter.status || filter.status.includes(f.status))),
    );
  }
  async getFamily(id: string) {
    return this.clone(this.data.families.find((f) => f.id === id) ?? null);
  }
  async getFamilyBySlug(slug: string) {
    return this.clone(this.data.families.find((f) => f.slug === slug) ?? null);
  }
  async getFamilyByCode(code: string) {
    return this.clone(this.data.families.find((f) => f.familyId === code) ?? null);
  }
  async createFamily(input: NewFamily) {
    const id = uuid();
    const fam: Family = {
      ...input,
      id,
      createdAt: nowIso(),
      children: input.children.map((c, i) => ({ ...c, id: uuid(), familyId: id, sortOrder: c.sortOrder ?? i })),
    };
    this.data.families.push(fam);
    this.persist();
    return this.clone(fam);
  }
  async updateFamily(id: string, patch: Partial<Family>) {
    const f = this.data.families.find((x) => x.id === id);
    if (!f) throw new Error('family not found');
    Object.assign(f, patch, { id: f.id, children: f.children });
    this.persist();
    return this.clone(f);
  }
  async incrementFamilyCounter(id: string, field: 'views' | 'claimStarts') {
    const f = this.data.families.find((x) => x.id === id);
    if (f) {
      f[field] = (f[field] ?? 0) + 1;
      this.persist();
    }
  }
  async nextFamilySequence(season: string) {
    const nums = this.data.families.filter((f) => f.season === season).map((f) => Number(f.familyId.split('-').pop()) || 0);
    return (nums.length ? Math.max(...nums) : 0) + 1;
  }

  async listSponsors() {
    return this.clone(this.data.sponsors);
  }
  async getSponsor(id: string) {
    return this.clone(this.data.sponsors.find((s) => s.id === id) ?? null);
  }
  async findSponsorByEmail(email: string) {
    const e = email.toLowerCase();
    return this.clone(this.data.sponsors.find((s) => s.email.toLowerCase() === e) ?? null);
  }
  async createSponsor(input: NewSponsor) {
    const s: Sponsor = { ...input, id: uuid(), createdAt: nowIso() };
    this.data.sponsors.push(s);
    this.persist();
    return this.clone(s);
  }

  async listSponsorships(filter: { status?: SponsorshipStatus[]; familyId?: string; sponsorId?: string } = {}) {
    return this.clone(
      this.data.sponsorships.filter(
        (s) =>
          (!filter.status || filter.status.includes(s.status)) &&
          (!filter.familyId || s.familyId === filter.familyId) &&
          (!filter.sponsorId || s.sponsorId === filter.sponsorId),
      ),
    );
  }
  async getSponsorship(id: string) {
    return this.clone(this.data.sponsorships.find((s) => s.id === id) ?? null);
  }
  async getSponsorshipByToken(token: string) {
    return this.clone(this.data.sponsorships.find((s) => s.token === token) ?? null);
  }
  async getSponsorshipByCode(code: string) {
    return this.clone(this.data.sponsorships.find((s) => s.sponsorshipId === code) ?? null);
  }
  async createSponsorship(input: NewSponsorship) {
    const s: Sponsorship = { ...input, id: uuid(), createdAt: nowIso() };
    this.data.sponsorships.push(s);
    this.persist();
    return this.clone(s);
  }
  async updateSponsorship(id: string, patch: Partial<Sponsorship>) {
    const s = this.data.sponsorships.find((x) => x.id === id);
    if (!s) throw new Error('sponsorship not found');
    Object.assign(s, patch, { id: s.id });
    this.persist();
    return this.clone(s);
  }

  async logActivity(input: NewActivity) {
    const a: Activity = { ...input, id: uuid() };
    this.data.activity.push(a);
    if (this.data.activity.length > 20000) this.data.activity.splice(0, this.data.activity.length - 20000);
    this.persist();
    return this.clone(a);
  }
  async listActivity(filter: ActivityFilter = {}) {
    let rows = this.data.activity;
    if (filter.since) rows = rows.filter((a) => a.occurredAt >= filter.since!);
    if (filter.types) rows = rows.filter((a) => filter.types!.includes(a.type));
    if (filter.familyId) rows = rows.filter((a) => a.familyId === filter.familyId);
    if (filter.sponsorshipId) rows = rows.filter((a) => a.sponsorshipId === filter.sponsorshipId);
    rows = [...rows].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    if (filter.limit) rows = rows.slice(0, filter.limit);
    return this.clone(rows);
  }

  async getSettings() {
    return this.clone(this.data.settings);
  }
  async updateSettings(patch: Partial<SeasonSettings>) {
    this.data.settings = { ...this.data.settings, ...patch };
    this.persist();
    return this.clone(this.data.settings);
  }
}
