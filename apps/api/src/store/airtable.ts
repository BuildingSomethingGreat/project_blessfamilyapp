import type { Activity, Family, FamilyStatus, SeasonSettings, Sponsor, Sponsorship, SponsorshipStatus, Child } from '@bless/shared';
import { DEFAULT_SETTINGS, type ActivityFilter, type NewActivity, type NewFamily, type NewSponsor, type NewSponsorship, type Store } from './types.ts';
import { uuid } from '../lib/ids.ts';

/**
 * Airtable adapter. Field names mirror the base created for The Konnection
 * (see docs/AIRTABLE.md). Reads are cached briefly because Airtable allows
 * 5 requests/second per base; writes invalidate the cache.
 */
type Rec = { id: string; createdTime: string; fields: Record<string, any> };

const T = { families: 'Families', children: 'Children', sponsors: 'Sponsors', sponsorships: 'Sponsorships', activity: 'Activity', settings: 'Settings' } as const;

const esc = (s: string) => s.replace(/'/g, "\\'");

export class AirtableStore implements Store {
  readonly kind = 'airtable' as const;
  private cache = new Map<string, { at: number; value: unknown }>();
  private ttlMs = 20_000;

  constructor(private token: string, private baseId: string) {
    if (!token) throw new Error('AIRTABLE_TOKEN is required when STORE=airtable');
  }

  async init() {
    await this.getSettings();
  }

  // ---- HTTP -------------------------------------------------------------
  private async req<T>(method: string, table: string, pathPart = '', body?: unknown, query?: Record<string, string | string[]>): Promise<T> {
    const url = new URL(`https://api.airtable.com/v0/${this.baseId}/${encodeURIComponent(table)}${pathPart}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
        else url.searchParams.set(k, v);
      }
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Airtable ${method} ${table} failed: ${res.status} ${await res.text()}`);
      return (await res.json()) as T;
    }
    throw new Error('Airtable rate limited');
  }

  private async all(table: string, params: Record<string, string | string[]> = {}): Promise<Rec[]> {
    const key = table + JSON.stringify(params);
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value as Rec[];
    const out: Rec[] = [];
    let offset: string | undefined;
    do {
      const q: Record<string, string | string[]> = { pageSize: '100', ...params };
      if (offset) q.offset = offset;
      const page = await this.req<{ records: Rec[]; offset?: string }>('GET', table, '', undefined, q);
      out.push(...page.records);
      offset = page.offset;
    } while (offset);
    this.cache.set(key, { at: Date.now(), value: out });
    return out;
  }

  private bust() {
    this.cache.clear();
  }

  private async create(table: string, fields: Record<string, unknown>): Promise<Rec> {
    const r = await this.req<{ records: Rec[] }>('POST', table, '', { records: [{ fields }], typecast: true });
    this.bust();
    return r.records[0];
  }
  private async createMany(table: string, rows: Record<string, unknown>[]): Promise<Rec[]> {
    const out: Rec[] = [];
    for (let i = 0; i < rows.length; i += 10) {
      const r = await this.req<{ records: Rec[] }>('POST', table, '', { records: rows.slice(i, i + 10).map((fields) => ({ fields })), typecast: true });
      out.push(...r.records);
    }
    this.bust();
    return out;
  }
  private async patch(table: string, id: string, fields: Record<string, unknown>): Promise<Rec> {
    const r = await this.req<Rec>('PATCH', table, `/${id}`, { fields, typecast: true });
    this.bust();
    return r;
  }

  // ---- mappers ------------------------------------------------------------
  private childFrom(r: Rec): Child {
    const f = r.fields;
    return {
      id: r.id, familyId: f['Family']?.[0] ?? '', name: f['Name'] ?? '', age: Number(f['Age'] ?? 0), gender: f['Gender'] ?? 'Male',
      clothingCategory: f['Clothing Category'] ?? 'Youth / Kids', shirtSize: f['Shirt Size'] ?? '', pantsSize: f['Pants Size'] ?? '',
      shoeCategory: f['Shoe Category'] ?? 'Youth / Kids', shoeSize: f['Shoe Size'] ?? '', sizeNotes: f['Size Notes'] ?? '', favoriteColor: f['Favorite Color'] ?? '',
      hobbies: f['Hobbies'] ?? '', clothingWishlist: f['Clothing Wishlist'] ?? [], otherClothing: f['Other Clothing'] ?? '', giftTypes: f['Gift Types'] ?? [],
      specificGifts: f['Specific Gifts'] ?? '', sortOrder: Number(f['Sort Order'] ?? 0),
    };
  }
  private childTo(c: Partial<Child>, familyRecId: string) {
    return {
      Name: c.name, Age: c.age, Gender: c.gender, 'Clothing Category': c.clothingCategory, 'Shirt Size': c.shirtSize, 'Pants Size': c.pantsSize,
      'Shoe Category': c.shoeCategory, 'Shoe Size': c.shoeSize, 'Size Notes': c.sizeNotes, 'Favorite Color': c.favoriteColor, Hobbies: c.hobbies,
      'Clothing Wishlist': c.clothingWishlist, 'Other Clothing': c.otherClothing, 'Gift Types': c.giftTypes, 'Specific Gifts': c.specificGifts,
      'Sort Order': c.sortOrder, Family: [familyRecId],
    };
  }
  private familyFrom(r: Rec, children: Child[]): Family {
    const f = r.fields;
    return {
      id: r.id, familyId: f['Family ID'] ?? '', season: f['Season'] ?? '', status: (f['Status'] ?? 'Submitted') as FamilyStatus, slug: f['Slug'] ?? '',
      nickname: f['Nickname'] ?? '', guardianName: f['Guardian Name'] ?? '', phone: f['Phone'] ?? '', email: f['Email'] ?? '',
      preferredContact: f['Preferred Contact'] ?? 'Text', address: f['Address'] ?? '', city: f['City'] ?? '', state: f['State'] ?? '', zip: f['ZIP'] ?? '',
      transportation: f['Transportation'] ?? 'No', familyStory: f['Family Story'] ?? '', storyApproved: !!f['Story Approved'],
      eligibilityConfirmed: !!f['Eligibility Confirmed'], notes: f['Notes'] ?? '', adminNotes: f['Admin Notes'] ?? '', views: Number(f['Views'] ?? 0),
      claimStarts: Number(f['Claim Starts'] ?? 0), createdAt: f['Created At'] ?? r.createdTime, approvedAt: f['Approved At'] ?? null, fulfilledAt: f['Fulfilled At'] ?? null,
      children: children.sort((a, b) => a.sortOrder - b.sortOrder),
    };
  }
  private familyTo(p: Partial<Family>) {
    const m: Record<string, unknown> = {
      'Family ID': p.familyId, Season: p.season, Status: p.status, Slug: p.slug, Nickname: p.nickname, 'Guardian Name': p.guardianName, Phone: p.phone,
      Email: p.email || undefined, 'Preferred Contact': p.preferredContact, Address: p.address, City: p.city, State: p.state, ZIP: p.zip,
      Transportation: p.transportation, 'Family Story': p.familyStory, 'Story Approved': p.storyApproved, 'Eligibility Confirmed': p.eligibilityConfirmed,
      Notes: p.notes, 'Admin Notes': p.adminNotes, Views: p.views, 'Claim Starts': p.claimStarts, 'Approved At': p.approvedAt, 'Fulfilled At': p.fulfilledAt,
    };
    return strip(m);
  }
  private sponsorFrom(r: Rec): Sponsor {
    const f = r.fields;
    return { id: r.id, name: f['Name'] ?? '', email: f['Email'] ?? '', phone: f['Phone'] ?? '', organization: f['Organization'] ?? '', preferredContact: f['Preferred Contact'] ?? 'Email', notes: f['Notes'] ?? '', createdAt: f['Created At'] ?? r.createdTime };
  }
  private sponsorshipFrom(r: Rec): Sponsorship {
    const f = r.fields;
    return {
      id: r.id, sponsorshipId: f['Sponsorship ID'] ?? '', familyId: f['Family']?.[0] ?? '', sponsorId: f['Sponsor']?.[0] ?? '', status: (f['Status'] ?? 'Claimed') as SponsorshipStatus,
      token: f['Token'] ?? '', claimedAt: f['Claimed At'] ?? r.createdTime, confirmedAt: f['Confirmed At'] ?? null, shoppingAt: f['Shopping At'] ?? null,
      droppedOffAt: f['Dropped Off At'] ?? null, deliveredAt: f['Delivered At'] ?? null, releasedAt: f['Released At'] ?? null, nextFollowUpAt: f['Next Follow Up At'] ?? null,
      lastNudgedAt: f['Last Nudged At'] ?? null, lastResponseAt: f['Last Response At'] ?? null, followUpCount: Number(f['Follow Up Count'] ?? 0), flagged: !!f['Flagged'],
      flagReason: f['Flag Reason'] ?? '', releaseReason: f['Release Reason'] ?? '', sponsorNote: f['Sponsor Note'] ?? '', adminNotes: f['Admin Notes'] ?? '', createdAt: f['Created At'] ?? r.createdTime,
    };
  }
  private sponsorshipTo(p: Partial<Sponsorship>) {
    return strip({
      'Sponsorship ID': p.sponsorshipId, Status: p.status, Token: p.token, 'Claimed At': p.claimedAt, 'Confirmed At': p.confirmedAt, 'Shopping At': p.shoppingAt,
      'Dropped Off At': p.droppedOffAt, 'Delivered At': p.deliveredAt, 'Released At': p.releasedAt, 'Next Follow Up At': p.nextFollowUpAt, 'Last Nudged At': p.lastNudgedAt,
      'Last Response At': p.lastResponseAt, 'Follow Up Count': p.followUpCount, Flagged: p.flagged, 'Flag Reason': p.flagReason, 'Release Reason': p.releaseReason,
      'Sponsor Note': p.sponsorNote, 'Admin Notes': p.adminNotes, Family: p.familyId ? [p.familyId] : undefined, Sponsor: p.sponsorId ? [p.sponsorId] : undefined,
    });
  }
  private activityFrom(r: Rec): Activity {
    const f = r.fields;
    let meta: Record<string, unknown> = {};
    try { meta = f['Meta'] ? JSON.parse(f['Meta']) : {}; } catch { /* ignore */ }
    return { id: r.id, type: f['Type'] ?? 'admin_action', channel: f['Channel'] ?? 'system', familyId: f['Family']?.[0] ?? null, sponsorshipId: f['Sponsorship']?.[0] ?? null, subject: f['Subject'] ?? '', body: f['Body'] ?? '', meta, occurredAt: f['Occurred At'] ?? r.createdTime };
  }

  // ---- families -----------------------------------------------------------
  private async childrenByFamily(): Promise<Map<string, Child[]>> {
    const rows = await this.all(T.children);
    const map = new Map<string, Child[]>();
    for (const r of rows) {
      const c = this.childFrom(r);
      if (!c.familyId) continue;
      if (!map.has(c.familyId)) map.set(c.familyId, []);
      map.get(c.familyId)!.push(c);
    }
    return map;
  }
  async listFamilies(filter: { season?: string; status?: FamilyStatus[] } = {}) {
    const [rows, kids] = await Promise.all([this.all(T.families), this.childrenByFamily()]);
    return rows
      .map((r) => this.familyFrom(r, kids.get(r.id) ?? []))
      .filter((f) => (!filter.season || f.season === filter.season) && (!filter.status || filter.status.includes(f.status)));
  }
  async getFamily(id: string) {
    const all = await this.listFamilies();
    return all.find((f) => f.id === id) ?? null;
  }
  async getFamilyBySlug(slug: string) {
    const all = await this.listFamilies();
    return all.find((f) => f.slug === slug) ?? null;
  }
  async getFamilyByCode(code: string) {
    const all = await this.listFamilies();
    return all.find((f) => f.familyId === code) ?? null;
  }
  async createFamily(input: NewFamily) {
    const { children, ...rest } = input;
    const rec = await this.create(T.families, this.familyTo(rest));
    const kidRecs = await this.createMany(T.children, children.map((c, i) => this.childTo({ ...c, sortOrder: c.sortOrder ?? i }, rec.id)));
    return this.familyFrom(rec, kidRecs.map((r) => this.childFrom(r)));
  }
  async updateFamily(id: string, patch: Partial<Family>) {
    await this.patch(T.families, id, this.familyTo(patch));
    const f = await this.getFamily(id);
    if (!f) throw new Error('family not found');
    return f;
  }
  async incrementFamilyCounter(id: string, field: 'views' | 'claimStarts') {
    const f = await this.getFamily(id);
    if (!f) return;
    await this.patch(T.families, id, { [field === 'views' ? 'Views' : 'Claim Starts']: (f[field] ?? 0) + 1 });
  }
  async nextFamilySequence(season: string) {
    const all = await this.listFamilies({ season });
    const nums = all.map((f) => Number(f.familyId.split('-').pop()) || 0);
    return (nums.length ? Math.max(...nums) : 0) + 1;
  }

  // ---- sponsors -------------------------------------------------------------
  async listSponsors() {
    return (await this.all(T.sponsors)).map((r) => this.sponsorFrom(r));
  }
  async getSponsor(id: string) {
    return (await this.listSponsors()).find((s) => s.id === id) ?? null;
  }
  async findSponsorByEmail(email: string) {
    const e = email.toLowerCase();
    return (await this.listSponsors()).find((s) => s.email.toLowerCase() === e) ?? null;
  }
  async createSponsor(input: NewSponsor) {
    const r = await this.create(T.sponsors, strip({ Name: input.name, Email: input.email, Phone: input.phone || undefined, Organization: input.organization, 'Preferred Contact': input.preferredContact, Notes: input.notes }));
    return this.sponsorFrom(r);
  }

  // ---- sponsorships ---------------------------------------------------------
  async listSponsorships(filter: { status?: SponsorshipStatus[]; familyId?: string; sponsorId?: string } = {}) {
    return (await this.all(T.sponsorships))
      .map((r) => this.sponsorshipFrom(r))
      .filter((s) => (!filter.status || filter.status.includes(s.status)) && (!filter.familyId || s.familyId === filter.familyId) && (!filter.sponsorId || s.sponsorId === filter.sponsorId));
  }
  async getSponsorship(id: string) {
    return (await this.listSponsorships()).find((s) => s.id === id) ?? null;
  }
  async getSponsorshipByToken(token: string) {
    const rows = await this.all(T.sponsorships, { filterByFormula: `{Token}='${esc(token)}'` });
    return rows.length ? this.sponsorshipFrom(rows[0]) : null;
  }
  async getSponsorshipByCode(code: string) {
    return (await this.listSponsorships()).find((s) => s.sponsorshipId === code) ?? null;
  }
  async createSponsorship(input: NewSponsorship) {
    const r = await this.create(T.sponsorships, this.sponsorshipTo(input));
    return this.sponsorshipFrom(r);
  }
  async updateSponsorship(id: string, patch: Partial<Sponsorship>) {
    const r = await this.patch(T.sponsorships, id, this.sponsorshipTo(patch));
    return this.sponsorshipFrom(r);
  }

  // ---- activity ---------------------------------------------------------------
  async logActivity(input: NewActivity) {
    const r = await this.create(T.activity, strip({
      'Activity ID': uuid(), Type: input.type, Channel: input.channel, Subject: input.subject, Body: input.body, Meta: JSON.stringify(input.meta ?? {}),
      'Occurred At': input.occurredAt, Family: input.familyId ? [input.familyId] : undefined, Sponsorship: input.sponsorshipId ? [input.sponsorshipId] : undefined,
    }));
    return this.activityFrom(r);
  }
  async listActivity(filter: ActivityFilter = {}) {
    let rows = (await this.all(T.activity, { 'sort[0][field]': 'Occurred At', 'sort[0][direction]': 'desc' })).map((r) => this.activityFrom(r));
    if (filter.since) rows = rows.filter((a) => a.occurredAt >= filter.since!);
    if (filter.types) rows = rows.filter((a) => filter.types!.includes(a.type));
    if (filter.familyId) rows = rows.filter((a) => a.familyId === filter.familyId);
    if (filter.sponsorshipId) rows = rows.filter((a) => a.sponsorshipId === filter.sponsorshipId);
    if (filter.limit) rows = rows.slice(0, filter.limit);
    return rows;
  }

  // ---- settings ---------------------------------------------------------------
  async getSettings(): Promise<SeasonSettings> {
    const rows = await this.all(T.settings);
    const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const r of rows) {
      const k = r.fields['Key'];
      if (!k || !(k in DEFAULT_SETTINGS)) continue;
      const v = r.fields['Value'] ?? '';
      out[k] = typeof (DEFAULT_SETTINGS as any)[k] === 'boolean' ? v === 'true' : v;
    }
    return out as unknown as SeasonSettings;
  }
  async updateSettings(patch: Partial<SeasonSettings>) {
    const rows = await this.all(T.settings);
    for (const [k, v] of Object.entries(patch)) {
      const existing = rows.find((r) => r.fields['Key'] === k);
      const Value = String(v);
      if (existing) await this.patch(T.settings, existing.id, { Value });
      else await this.create(T.settings, { Key: k, Value });
    }
    return this.getSettings();
  }
}

function strip(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
