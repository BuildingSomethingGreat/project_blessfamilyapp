import { ACTIVE_SPONSORSHIP_STATUSES, deriveNickname, nicknameProblem, toPublicFamily, GOAL_PER_CHILD, CARD_FEE, type ChipIn, type ClaimRequest, type CommunityView, type FamilyApplication, type Family, type PublicFamily, type QuoteSubmit, type Sponsor, type SponsorPortalView, type WallEntry } from '@bless/shared';
import type { Store } from '../store/types.ts';
import { FollowUpEngine, nextFollowUp } from '../followup/engine.ts';
import { Mailer } from '../notify/mailer.ts';
import { familyCode, nowIso, shortId, token as newToken } from './ids.ts';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Public credit line for a Holiday Konnector: their chosen display name, else "First L." (never a full surname). */
export function wallName(s: Pick<Sponsor, 'displayName' | 'name'>): string {
  if (s.displayName.trim()) return s.displayName.trim();
  const [first, ...rest] = s.name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first || 'A Holiday Konnector';
}

/**
 * Per-process mutex so two Konnectors can't claim the same family at once. Serverless runs several
 * instances, so claim() also re-checks the store after writing (see the duplicate guard below).
 */
const locks = new Map<string, Promise<unknown>>();
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  locks.set(key, prev.then(() => mine));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === mine) locks.delete(key);
  }
}

/** Waits for side-effect emails without letting one failure break the request (serverless can't finish work after responding). */
const settle = (...ps: Promise<unknown>[]) => Promise.allSettled(ps).then((rs) => rs.forEach((r) => r.status === 'rejected' && console.error('[email] failed', r.reason)));

export class Services {
  readonly followUp: FollowUpEngine;
  readonly mailer: Mailer;
  constructor(public store: Store) {
    this.mailer = new Mailer(store);
    this.followUp = new FollowUpEngine(store, this.mailer);
  }

  async registerFamily(app: FamilyApplication): Promise<Family> {
    const settings = await this.store.getSettings();
    if (!settings.registrationOpen) throw new HttpError(403, 'Registration is closed for this season.');
    // A nickname the family chose is public, so it must not identify them (checked before we take a family number).
    const chosen = app.nickname.trim();
    const nickIssue = chosen ? nicknameProblem(chosen, { guardianName: app.guardianName, childNames: app.children.map((c) => c.name) }) : null;
    if (nickIssue) throw new HttpError(400, nickIssue);
    const seq = await this.store.nextFamilySequence(settings.season);
    const code = familyCode(settings.season, seq);
    const children = app.children.map((c, i) => ({ ...c, sortOrder: i }));
    // The photo question can be switched off in admin settings; ignore a stray photo if it is.
    const photo = settings.askFamilyPhoto ? app.photoDataUrl : '';
    const family = await this.store.createFamily({
      familyId: code, season: settings.season, status: 'Submitted', slug: shortId(), nickname: chosen || deriveNickname(children, code),
      guardianName: app.guardianName, phone: app.phone, email: app.email, preferredContact: app.preferredContact, address: app.address, city: app.city, state: app.state.toUpperCase(),
      zip: app.zip, transportation: app.transportation, familyStory: app.familyStory, storyApproved: false, eligibilityConfirmed: true, notes: app.notes, adminNotes: '',
      photoUrl: '', photoApproved: false, photoPrivate: !!app.photoPrivate, raised: 0, goal: GOAL_PER_CHILD * children.length,
      views: 0, claimStarts: 0, approvedAt: null, fulfilledAt: null, children,
    });
    if (photo) {
      try {
        const url = await this.store.storeFamilyPhoto(family.id, photo);
        family.photoUrl = url;
      } catch (e) {
        console.error('photo store failed', (e as Error).message);
      }
    }
    await this.store.logActivity({ type: 'status_change', channel: 'web', familyId: family.id, sponsorshipId: null, subject: `Application received: ${code}`, body: '', meta: { to: 'Submitted' }, occurredAt: nowIso() });
    await settle(this.followUp.sendToFamily('family_received', family), this.followUp.alert({ kind: 'admin_new_application', family, pub: toPublicFamily(family) }, { familyId: family.id }));
    return family;
  }

  async publicCatalog(): Promise<{ families: PublicFamily[]; counts: { available: number; claimed: number; fulfilled: number; kids: number } }> {
    const settings = await this.store.getSettings();
    const all = await this.store.listFamilies({ season: settings.season });
    const counts = { available: 0, claimed: 0, fulfilled: 0, kids: 0 };
    for (const f of all) {
      if (['Available', 'Claimed', 'Fulfilled'].includes(f.status)) counts.kids += f.children.length;
      if (f.status === 'Available') counts.available++;
      else if (f.status === 'Claimed') counts.claimed++;
      else if (f.status === 'Fulfilled') counts.fulfilled++;
    }
    const families = all.filter((f) => f.status === 'Available').map((f) => toPublicFamily(f)).sort((a, b) => b.daysWaiting - a.daysWaiting);
    return { families, counts };
  }

  async publicFamily(slug: string): Promise<PublicFamily> {
    const f = await this.store.getFamilyBySlug(slug);
    if (!f || !['Available', 'Claimed', 'Fulfilled'].includes(f.status)) throw new HttpError(404, 'Family not found');
    return toPublicFamily(f);
  }

  async recordView(slug: string) {
    const f = await this.store.getFamilyBySlug(slug);
    if (!f) return;
    await this.store.incrementFamilyCounter(f.id, 'views');
    await this.store.logActivity({ type: 'family_view', channel: 'web', familyId: f.id, sponsorshipId: null, subject: 'Viewed', body: '', meta: {}, occurredAt: nowIso() });
  }

  async recordClaimStart(slug: string) {
    const f = await this.store.getFamilyBySlug(slug);
    if (!f) return;
    await this.store.incrementFamilyCounter(f.id, 'claimStarts');
    await this.store.logActivity({ type: 'claim_start', channel: 'web', familyId: f.id, sponsorshipId: null, subject: 'Started claim', body: '', meta: {}, occurredAt: nowIso() });
  }

  async claim(slug: string, req: ClaimRequest): Promise<{ sponsorEmail: string; token: string; sponsorshipId: string; family: PublicFamily }> {
    return withLock(`claim:${slug}`, async () => {
      const settings = await this.store.getSettings();
      if (!settings.catalogOpen) throw new HttpError(403, 'Sponsorships are closed for this season.');
      const f = await this.store.getFamilyBySlug(slug);
      if (!f) throw new HttpError(404, 'Family not found');
      const taken = 'Someone just claimed this family. Thank you for trying — there are other families waiting.';
      if (f.status !== 'Available') throw new HttpError(409, taken);
      const existing = await this.store.listSponsorships();
      if (existing.some((x) => x.familyId === f.id && ACTIVE_SPONSORSHIP_STATUSES.includes(x.status))) throw new HttpError(409, taken);
      const wall = req.wallOptIn ? { wallOptIn: true, displayName: req.displayName } : {};
      let sponsor = await this.store.findSponsorByEmail(req.email);
      // A returning sponsor may claim for someone else (another org, a relative). Their account keeps its
      // details; anything different for this family is noted on the sponsorship so the team sees it.
      const forThisFamily: string[] = [];
      if (!sponsor) sponsor = await this.store.createSponsor({ name: req.name, email: req.email.toLowerCase(), phone: req.phone, organization: req.organization, preferredContact: 'Email', notes: '', displayName: '', wallOptIn: false, wallHidden: false, ...wall });
      else {
        const fill: Partial<Sponsor> = { ...wall };
        if (req.phone && !sponsor.phone) fill.phone = req.phone;
        if (req.organization && !sponsor.organization) fill.organization = req.organization;
        const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
        if (req.name.trim() && !same(req.name, sponsor.name)) forThisFamily.push(`Name given: ${req.name.trim()}`);
        if (req.organization && sponsor.organization && !same(req.organization, sponsor.organization)) forThisFamily.push(`On behalf of: ${req.organization.trim()}`);
        if (req.phone && sponsor.phone && req.phone.replace(/\D/g, '') !== sponsor.phone.replace(/\D/g, '')) forThisFamily.push(`Phone for this family: ${req.phone.trim()}`);
        if (Object.keys(fill).length) sponsor = await this.store.updateSponsor(sponsor.id, fill);
      }
      const seq = existing.length + 1;
      const now = nowIso();
      const next = nextFollowUp('Claimed', settings);
      const s = await this.store.createSponsorship({
        sponsorshipId: `SP-${settings.season}-${String(seq).padStart(3, '0')}`, familyId: f.id, sponsorId: sponsor.id, status: 'Claimed', token: newToken(), handoff: 'Drop off' /* staff switch trusted Konnectors to direct delivery */, claimedAt: now,
        shoppingAt: null, purchasedAt: null, wrappedAt: null, droppedOffAt: null, deliveredAt: null, releasedAt: null, nextFollowUpAt: next ? next.toISOString() : null, lastNudgedAt: null,
        lastResponseAt: null, followUpCount: 0, flagged: false, flagReason: '', releaseReason: '', sponsorNote: req.note, adminNotes: forThisFamily.join('\n'),
      });
      // Duplicate guard: another instance may have claimed the same family in the same few seconds.
      // The earliest claim wins; a later duplicate is released and the Konnector is told the family is taken.
      const rivals = (await this.store.listSponsorships({ familyId: f.id })).filter((x) => x.status === 'Claimed' && x.id !== s.id);
      if (rivals.some((x) => x.claimedAt < s.claimedAt || (x.claimedAt === s.claimedAt && x.id < s.id))) {
        await this.store.updateSponsorship(s.id, { status: 'Released', releasedAt: nowIso(), releaseReason: 'Duplicate claim (another Konnector was first)', nextFollowUpAt: null });
        throw new HttpError(409, taken);
      }
      await this.store.updateFamily(f.id, { status: 'Claimed' });
      await this.store.logActivity({ type: 'claim_complete', channel: 'web', familyId: f.id, sponsorshipId: s.id, subject: `${sponsor.name} claimed ${f.familyId}`, body: req.note, meta: { sponsorId: sponsor.id }, occurredAt: now });
      const claimed = { ...f, status: 'Claimed' as const };
      await settle(
        this.followUp.send('claim_confirmation', s, { actor: 'system' }),
        this.followUp.sendToFamily('family_matched', claimed),
        this.followUp.alert({ kind: 'admin_family_claimed', family: claimed, pub: toPublicFamily(claimed), sponsor: sponsor!, sponsorship: s }, { familyId: f.id, sponsorshipId: s.id }),
      );
      return { sponsorEmail: sponsor!.email, token: s.token, sponsorshipId: s.sponsorshipId, family: toPublicFamily({ ...f, status: 'Claimed' }) };
    });
  }

  /** Records a chip-in pledge. Actual card processing happens on the external checkout (settings.chipInUrl). */
  async chipIn(slug: string, req: ChipIn): Promise<{ checkoutUrl: string; total: number; family: PublicFamily }> {
    const settings = await this.store.getSettings();
    if (!settings.chipInsEnabled) throw new HttpError(403, 'Chip-ins are not open right now.');
    const f = await this.store.getFamilyBySlug(slug);
    if (!f || !['Available', 'Claimed'].includes(f.status)) throw new HttpError(404, 'Family not found');
    const total = Math.round((req.amount + (req.coverFees ? CARD_FEE : 0)) * 100) / 100;
    const updated = await this.store.updateFamily(f.id, { raised: (f.raised ?? 0) + req.amount });
    await this.store.logActivity({ type: 'chip_in', channel: 'web', familyId: f.id, sponsorshipId: null, subject: `$${req.amount} chip-in toward ${f.familyId}`, body: req.name ? `${req.name} <${req.email}>` : '', meta: { amount: req.amount, total, coverFees: req.coverFees, email: req.email }, occurredAt: nowIso() });
    const url = settings.chipInUrl ? `${settings.chipInUrl}${settings.chipInUrl.includes('?') ? '&' : '?'}amount=${encodeURIComponent(String(total))}&note=${encodeURIComponent(`Bless-A-Family ${f.familyId}`)}` : '';
    return { checkoutUrl: url, total, family: toPublicFamily(updated) };
  }

  async sponsorPortal(tok: string): Promise<SponsorPortalView> {
    const s = await this.store.getSponsorshipByToken(tok);
    if (!s) throw new HttpError(404, 'This link is not valid.');
    const [family, sponsor, settings, timeline] = await Promise.all([this.store.getFamily(s.familyId), this.store.getSponsor(s.sponsorId), this.store.getSettings(), this.store.listActivity({ sponsorshipId: s.id, limit: 30 })]);
    if (!family || !sponsor) throw new HttpError(404, 'This link is not valid.');
    return {
      sponsorship: { sponsorshipId: s.sponsorshipId, status: s.status, handoff: s.handoff ?? 'Drop off', claimedAt: s.claimedAt, shoppingAt: s.shoppingAt, purchasedAt: s.purchasedAt, wrappedAt: s.wrappedAt, droppedOffAt: s.droppedOffAt, deliveredAt: s.deliveredAt, releasedAt: s.releasedAt, sponsorNote: s.sponsorNote, nextFollowUpAt: s.nextFollowUpAt, followUpCount: s.followUpCount, flagged: s.flagged },
      sponsor: { name: sponsor.name, email: sponsor.email, preferredContact: sponsor.preferredContact, displayName: sponsor.displayName, wallOptIn: sponsor.wallOptIn },
      family: toPublicFamily(family),
      settings,
      // Only what the Konnector should see: emails sent to them, and their own updates. Team alerts,
      // family emails and staff actions share the sponsorship id but stay out of this view.
      timeline: timeline.filter((a) => a.type === 'sponsor_response' || a.type === 'status_change' || (a.type === 'message_sent' && ((a.meta as { audience?: string })?.audience ?? 'konnector') === 'konnector' && !String((a.meta as { kind?: string })?.kind ?? '').endsWith('_login'))).map((a) => ({ type: a.type, subject: a.subject, body: a.type === 'message_sent' ? a.body : '', occurredAt: a.occurredAt, channel: a.channel })),
    };
  }

  /** Konnector opts in/out of the public wall from their family page. */
  async setWall(tok: string, optIn: boolean, displayName: string) {
    const s = await this.store.getSponsorshipByToken(tok);
    if (!s) throw new HttpError(404, 'This link is not valid.');
    await this.store.updateSponsor(s.sponsorId, { wallOptIn: optIn, displayName: displayName.trim().slice(0, 80) });
    return this.sponsorPortal(tok);
  }

  /** Testimonials go in as Pending; staff approve them before anything is public. */
  async submitQuote(input: QuoteSubmit) {
    const settings = await this.store.getSettings();
    const s = input.token ? await this.store.getSponsorshipByToken(input.token) : null;
    const q = await this.store.createQuote({
      quote: input.quote, name: input.name, role: s ? 'Holiday Konnector' : input.role, organization: input.organization, email: input.email, status: 'Pending', featured: false,
      season: settings.season, familyId: s?.familyId ?? null, sponsorshipId: s?.id ?? null, submittedAt: nowIso(),
    });
    await this.store.logActivity({ type: 'quote', channel: 'web', familyId: q.familyId, sponsorshipId: q.sponsorshipId, subject: `New ${q.role === 'Konnection family' ? 'family' : 'Konnector'} quote from ${q.name}`, body: q.quote, meta: { quoteId: q.id }, occurredAt: q.submittedAt });
    await settle(this.followUp.alert({ kind: 'admin_quote', name: q.name, role: q.role, quote: q.quote }, { familyId: q.familyId, sponsorshipId: q.sponsorshipId }));
    return { ok: true };
  }

  /**
   * Public thank-you feed: approved quotes plus the Wall of Holiday Konnectors. A name only appears
   * once that Konnector opted in AND their gifts were handed off, and staff can hide any name.
   */
  async community(): Promise<CommunityView> {
    const settings = await this.store.getSettings();
    const [quotes, families, sponsorships, sponsors] = await Promise.all([
      this.store.listQuotes({ status: ['Approved'] }), this.store.listFamilies({ season: settings.season }), this.store.listSponsorships(), this.store.listSponsors(),
    ]);
    const fams = new Map(families.map((f) => [f.id, f]));
    const people = new Map(sponsors.map((p) => [p.id, p]));
    const done = sponsorships.filter((s) => fams.has(s.familyId) && (s.status === 'Dropped Off' || s.status === 'Delivered'));
    const wall = new Map<string, WallEntry>();
    for (const s of done) {
      const p = people.get(s.sponsorId);
      if (!p || !p.wallOptIn || p.wallHidden) continue;
      const name = wallName(p);
      const e = wall.get(name.toLowerCase()) ?? { name, families: 0, kids: 0, latestAt: '' };
      e.families += 1;
      e.kids += fams.get(s.familyId)!.children.length;
      const at = s.deliveredAt ?? s.droppedOffAt ?? s.claimedAt;
      if (at > e.latestAt) e.latestAt = at;
      wall.set(name.toLowerCase(), e);
    }
    const blessed = done.map((s) => fams.get(s.familyId)!);
    return {
      quotes: quotes
        .filter((q) => !q.season || q.season === settings.season || q.featured)
        .sort((a, b) => Number(b.featured) - Number(a.featured) || b.submittedAt.localeCompare(a.submittedAt))
        .slice(0, 12)
        .map(({ id, quote, name, role, organization, featured, season }) => ({ id, quote, name, role, organization, featured, season })),
      wall: [...wall.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt)),
      totals: { konnectors: new Set(done.map((s) => s.sponsorId)).size, familiesBlessed: blessed.length, kidsBlessed: blessed.reduce((n, f) => n + f.children.length, 0) },
    };
  }
}
