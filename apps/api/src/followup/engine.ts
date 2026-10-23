import { ACTIVE_SPONSORSHIP_STATUSES, familyStatusFor, toPublicFamily, type Family, type SeasonSettings, type Sponsorship, type SponsorshipStatus, type Sponsor } from '@bless/shared';
import { config } from '../config.ts';
import { getNotifier } from '../notify/index.ts';
import type { Store } from '../store/types.ts';
import { nowIso } from '../lib/ids.ts';
import { personalize, template, type MessageContext, type MessageKind } from './messages.ts';

/**
 * The dominoes engine.
 *
 * Every sponsorship carries `nextFollowUpAt`. The scheduler tick finds the
 * ones that are due, decides which message fits the sponsor's current step and
 * how close the deadline is, sends it, records it, and schedules the next one.
 * Any response from the sponsor (via their magic link) resets the counter.
 * After N unanswered nudges the sponsorship is flagged for an admin decision —
 * the system never silently releases a family.
 */

const H = 3_600_000;
const D = 24 * H;

export const portalUrl = (token: string) => `${config.webUrl}/s/${token}`;

export function daysToDeadline(settings: SeasonSettings, now = new Date()): number {
  // Calendar-day difference: 0 means "today", negative means the deadline passed.
  const dl = new Date(settings.dropoffDeadline + 'T00:00:00');
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dl.getTime() - today.getTime()) / D);
}

/** Pure scheduling policy — unit-tested. Returns the next time we should reach out. */
export function nextFollowUp(status: SponsorshipStatus, settings: SeasonSettings, now = new Date()): Date | null {
  const dl = daysToDeadline(settings, now);
  const at = (ms: number) => new Date(now.getTime() + ms);
  switch (status) {
    case 'Claimed':
      return at(config.followUp.confirmHours * H);
    case 'Confirmed':
      if (dl <= 2) return at(1 * D);
      if (dl <= 7) return at(3 * D);
      return at(5 * D);
    case 'Shopping': {
      // Reminders at deadline-7, -3, -1; otherwise weekly.
      for (const k of [7, 3, 1]) if (dl > k) return at((dl - k) * D);
      return dl >= 0 ? at(1 * D) : null;
    }
    case 'Dropped Off':
    case 'Delivered':
    case 'Released':
      return null;
  }
}

export function messageKindFor(s: Sponsorship, settings: SeasonSettings, now = new Date()): MessageKind | null {
  const dl = daysToDeadline(settings, now);
  if (s.status === 'Claimed') return 'confirm_nudge';
  if (s.status === 'Confirmed') return dl <= 3 ? 'deadline_reminder' : 'shopping_checkin';
  if (s.status === 'Shopping') return 'deadline_reminder';
  return null;
}

export class FollowUpEngine {
  constructor(private store: Store) {}

  async context(kind: MessageKind, s: Sponsorship | null, family: Family, sponsor: Sponsor | null, extra: Partial<MessageContext> = {}): Promise<MessageContext> {
    const settings = await this.store.getSettings();
    return {
      kind, family: toPublicFamily(family), fullFamily: family, sponsor: sponsor ?? undefined, sponsorship: s ?? undefined, settings,
      portalUrl: s ? portalUrl(s.token) : undefined, daysToDeadline: daysToDeadline(settings), followUpCount: s?.followUpCount, ...extra,
    };
  }

  /** Send a message to a sponsor on the channel they prefer and log it. */
  async send(kind: MessageKind, s: Sponsorship, opts: { custom?: string; reason?: string; actor?: 'system' | 'admin' | 'agent' } = {}) {
    const [family, sponsor] = await Promise.all([this.store.getFamily(s.familyId), this.store.getSponsor(s.sponsorId)]);
    if (!family || !sponsor) return { ok: false, error: 'missing family or sponsor' };
    const ctx = await this.context(kind, s, family, sponsor, { custom: opts.custom, reason: opts.reason });
    const base = template(ctx);
    const msg = opts.custom ? { ...base, text: opts.custom, sms: opts.custom.slice(0, 300) } : await personalize(ctx, base);
    const n = getNotifier();
    const wantsSms = sponsor.preferredContact === 'Text' && sponsor.phone && n.smsEnabled;
    const res = wantsSms ? await n.sendSms({ to: sponsor.phone, body: msg.sms }) : await n.sendEmail({ to: sponsor.email, subject: msg.subject, text: msg.text });
    await this.store.logActivity({
      type: 'message_sent', channel: wantsSms ? 'sms' : 'email', familyId: family.id, sponsorshipId: s.id, subject: msg.subject, body: msg.text,
      meta: { kind, ok: res.ok, error: res.error, actor: opts.actor ?? 'system', followUpCount: s.followUpCount }, occurredAt: nowIso(),
    });
    return { ok: res.ok, error: res.error, subject: msg.subject, text: msg.text };
  }

  /** Send to the family (application received / approved). */
  async sendToFamily(kind: 'family_received' | 'family_approved', family: Family) {
    if (!family.email && !(family.phone && getNotifier().smsEnabled)) return { ok: false, error: 'no contact channel' };
    const ctx = await this.context(kind, null, family, null);
    const msg = template(ctx);
    const n = getNotifier();
    const res = family.email ? await n.sendEmail({ to: family.email, subject: msg.subject, text: msg.text }) : await n.sendSms({ to: family.phone, body: msg.sms });
    await this.store.logActivity({ type: 'message_sent', channel: family.email ? 'email' : 'sms', familyId: family.id, sponsorshipId: null, subject: msg.subject, body: msg.text, meta: { kind, ok: res.ok, error: res.error }, occurredAt: nowIso() });
    return res;
  }

  /** Called whenever the sponsor moves a domino (from the portal or an admin). */
  async transition(s: Sponsorship, to: SponsorshipStatus, opts: { actor: 'sponsor' | 'admin' | 'agent' | 'system'; note?: string; reason?: string }) {
    const settings = await this.store.getSettings();
    const now = nowIso();
    const patch: Partial<Sponsorship> = { status: to };
    const stamp: Partial<Record<SponsorshipStatus, keyof Sponsorship>> = { Confirmed: 'confirmedAt', Shopping: 'shoppingAt', 'Dropped Off': 'droppedOffAt', Delivered: 'deliveredAt', Released: 'releasedAt' };
    const key = stamp[to];
    if (key) (patch as any)[key] = now;
    if (opts.actor === 'sponsor') {
      patch.lastResponseAt = now;
      patch.followUpCount = 0;
      patch.flagged = false;
      patch.flagReason = '';
    }
    if (opts.note) patch.sponsorNote = opts.note;
    if (to === 'Released') {
      patch.releaseReason = opts.reason ?? (opts.actor === 'sponsor' ? 'Sponsor released' : 'Released by staff');
      patch.nextFollowUpAt = null;
      patch.flagged = false;
    } else {
      const next = nextFollowUp(to, settings);
      patch.nextFollowUpAt = next ? next.toISOString() : null;
    }
    const updated = await this.store.updateSponsorship(s.id, patch);
    const family = await this.store.getFamily(s.familyId);
    if (family) {
      const fs = familyStatusFor(to);
      await this.store.updateFamily(family.id, { status: fs, fulfilledAt: to === 'Delivered' ? now : family.fulfilledAt });
    }
    await this.store.logActivity({
      type: opts.actor === 'sponsor' ? 'sponsor_response' : to === 'Released' ? 'release' : 'status_change', channel: opts.actor === 'sponsor' ? 'web' : 'system',
      familyId: s.familyId, sponsorshipId: s.id, subject: `${opts.actor === 'sponsor' ? 'Sponsor' : opts.actor} marked: ${to}`, body: opts.note ?? opts.reason ?? '',
      meta: { from: s.status, to, actor: opts.actor }, occurredAt: now,
    });
    // Thank-you dominoes fall automatically.
    if (to === 'Dropped Off' && opts.actor === 'sponsor') await this.send('dropoff_thanks', updated, { actor: 'system' });
    if (to === 'Delivered') await this.send('delivered_thanks', updated, { actor: 'system' });
    if (to === 'Released' && opts.actor !== 'sponsor') await this.send('released_notice', updated, { actor: 'system', reason: opts.reason });
    return updated;
  }

  /** One scheduler tick. Safe to call concurrently-ish: it re-reads before acting. */
  async tick(now = new Date()): Promise<{ sent: number; flagged: number; skipped: number }> {
    const settings = await this.store.getSettings();
    const due = (await this.store.listSponsorships({ status: ACTIVE_SPONSORSHIP_STATUSES })).filter((s) => s.nextFollowUpAt && new Date(s.nextFollowUpAt) <= now);
    let sent = 0, flagged = 0, skipped = 0;
    for (const s of due) {
      const kind = messageKindFor(s, settings, now);
      if (!kind) { skipped++; await this.store.updateSponsorship(s.id, { nextFollowUpAt: null }); continue; }
      const unanswered = s.lastResponseAt && s.lastNudgedAt ? new Date(s.lastResponseAt) < new Date(s.lastNudgedAt) : !!s.lastNudgedAt;
      const count = unanswered ? s.followUpCount : 0;
      if (count >= config.followUp.flagAfterNudges && !s.flagged) {
        // Hand it to a human instead of nudging forever.
        await this.store.updateSponsorship(s.id, { flagged: true, flagReason: `No response after ${count} follow-ups`, nextFollowUpAt: null });
        await this.store.logActivity({ type: 'flag', channel: 'system', familyId: s.familyId, sponsorshipId: s.id, subject: 'Flagged for admin: unresponsive sponsor', body: '', meta: { followUpCount: count }, occurredAt: nowIso() });
        flagged++;
        continue;
      }
      if (s.flagged) { skipped++; continue; }
      const res = await this.send(kind, s, { actor: 'system' });
      if (res.ok) sent++;
      const next = nextFollowUp(s.status, settings, now);
      await this.store.updateSponsorship(s.id, { lastNudgedAt: nowIso(), followUpCount: count + 1, nextFollowUpAt: next ? next.toISOString() : null });
    }
    return { sent, flagged, skipped };
  }
}

export function startScheduler(engine: FollowUpEngine) {
  if (!config.followUp.enabled) return null;
  const run = () => engine.tick().then((r) => (r.sent || r.flagged) && console.log('[followup]', r)).catch((e) => console.error('[followup] tick failed', e));
  setTimeout(run, 10_000);
  return setInterval(run, config.followUp.tickMinutes * 60_000);
}
