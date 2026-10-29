import { ACTIVE_SPONSORSHIP_STATUSES, SHOPPING_STATUSES, familyStatusFor, toPublicFamily, type Family, type SeasonSettings, type Sponsorship, type SponsorshipStatus, type Sponsor } from '@bless/shared';
import { config } from '../config.ts';
import type { Mailer } from '../notify/mailer.ts';
import type { Store } from '../store/types.ts';
import { nowIso } from '../lib/ids.ts';
import { adminAlert, template, type AdminAlert, type MessageContext, type MessageKind } from './messages.ts';

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
      // Claimed but not shopping: nudge after 48h.
      return at(config.followUp.confirmHours * H);
    case 'Shopping':
    case 'Purchased':
    case 'Wrapped':
      // Working the list: every 5 days, daily inside the last week.
      if (dl < 0) return null;
      return at((dl <= 7 ? 1 : 5) * D);
    case 'Dropped Off':
    case 'Delivered':
    case 'Released':
      return null;
  }
}

export function messageKindFor(s: Sponsorship, settings: SeasonSettings, now = new Date()): MessageKind | null {
  const dl = daysToDeadline(settings, now);
  if (s.status === 'Claimed') return 'confirm_nudge';
  if (SHOPPING_STATUSES.includes(s.status)) return dl <= 7 ? 'deadline_reminder' : 'shopping_checkin';
  return null;
}

export class FollowUpEngine {
  constructor(private store: Store, readonly mailer: Mailer) {}

  /** Email the admin team (ADMIN_EMAILS) about something that needs their attention. */
  async alert(a: AdminAlert, ids: { familyId?: string | null; sponsorshipId?: string | null } = {}) {
    const msg = adminAlert(a);
    return this.mailer.toAdmins({ subject: msg.subject, spec: msg.spec, kind: a.kind, familyId: ids.familyId, sponsorshipId: ids.sponsorshipId }).catch((e) => console.error('[alert] failed', e));
  }

  async context(kind: MessageKind, s: Sponsorship | null, family: Family, sponsor: Sponsor | null, extra: Partial<MessageContext> = {}): Promise<MessageContext> {
    const settings = await this.store.getSettings();
    return {
      kind, family: toPublicFamily(family), fullFamily: family, sponsor: sponsor ?? undefined, sponsorship: s ?? undefined, settings,
      portalUrl: s ? portalUrl(s.token) : undefined, daysToDeadline: daysToDeadline(settings), followUpCount: s?.followUpCount, ...extra,
    };
  }

  /** Email a Holiday Konnector. A custom body (from staff or the assistant) goes out as a "note" email. */
  async send(kind: MessageKind, s: Sponsorship, opts: { custom?: string; reason?: string; actor?: 'system' | 'admin' | 'agent' } = {}) {
    const [family, sponsor] = await Promise.all([this.store.getFamily(s.familyId), this.store.getSponsor(s.sponsorId)]);
    if (!family || !sponsor) return { ok: false, error: 'missing family or sponsor', subject: '', text: '' };
    const k: MessageKind = opts.custom ? 'staff_note' : kind;
    const ctx = await this.context(k, s, family, sponsor, { custom: opts.custom, reason: opts.reason });
    const msg = template(ctx);
    return this.mailer.send({ to: sponsor.email, subject: msg.subject, spec: msg.spec, kind: k, audience: 'konnector', familyId: family.id, sponsorshipId: s.id, actor: opts.actor ?? 'system' });
  }

  /** Email the family (received, approved, matched, or a custom note). Families without an email are skipped. */
  async sendToFamily(kind: 'family_received' | 'family_approved' | 'family_matched' | 'family_note', family: Family, opts: { custom?: string; actor?: 'system' | 'admin' | 'agent' } = {}) {
    if (!family.email) return { ok: false, error: 'No email on file for this family', subject: '' };
    const ctx = await this.context(kind, null, family, null, { custom: opts.custom });
    const msg = template(ctx);
    return this.mailer.send({ to: family.email, subject: msg.subject, spec: msg.spec, kind, audience: 'family', familyId: family.id, actor: opts.actor ?? 'system' });
  }

  /** Called whenever the sponsor moves a domino (from the portal or an admin). */
  async transition(s: Sponsorship, to: SponsorshipStatus, opts: { actor: 'sponsor' | 'admin' | 'agent' | 'system'; note?: string; reason?: string }) {
    const settings = await this.store.getSettings();
    const now = nowIso();
    const patch: Partial<Sponsorship> = { status: to };
    const stamp: Partial<Record<SponsorshipStatus, keyof Sponsorship>> = { Shopping: 'shoppingAt', Purchased: 'purchasedAt', Wrapped: 'wrappedAt', 'Dropped Off': 'droppedOffAt', Delivered: 'deliveredAt', Released: 'releasedAt' };
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
      familyId: s.familyId, sponsorshipId: s.id, subject: `${opts.actor === 'sponsor' ? 'Konnector' : opts.actor} marked: ${to}`, body: opts.note ?? opts.reason ?? '',
      meta: { from: s.status, to, actor: opts.actor }, occurredAt: now,
    });
    // Emails fall like dominoes: thank-yous to the Konnector, alerts to the team.
    const sponsor = await this.store.getSponsor(s.sponsorId);
    const ids = { familyId: s.familyId, sponsorshipId: s.id };
    if (to === 'Dropped Off') {
      if (opts.actor === 'sponsor') await this.send('dropoff_thanks', updated, { actor: 'system' });
      if (family) await this.alert({ kind: 'admin_handed_off', family, pub: toPublicFamily(family), sponsor, sponsorship: updated }, ids);
    }
    if (to === 'Delivered') await this.send('delivered_thanks', updated, { actor: 'system' });
    if (to === 'Released') {
      await this.send(opts.actor === 'sponsor' ? 'release_confirmation' : 'released_notice', updated, { actor: 'system', reason: opts.reason });
      if (family && opts.actor !== 'admin') await this.alert({ kind: 'admin_family_released', family, pub: toPublicFamily(family), sponsor, reason: patch.releaseReason ?? '', by: opts.actor === 'sponsor' ? 'The Konnector' : opts.actor === 'agent' ? 'Assistant' : 'System' }, ids);
    }
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
        await this.store.logActivity({ type: 'flag', channel: 'system', familyId: s.familyId, sponsorshipId: s.id, subject: 'Flagged for admin: unresponsive Konnector', body: '', meta: { followUpCount: count }, occurredAt: nowIso() });
        const [family, sponsor] = await Promise.all([this.store.getFamily(s.familyId), this.store.getSponsor(s.sponsorId)]);
        if (family) await this.alert({ kind: 'admin_flagged', family, pub: toPublicFamily(family), sponsor, sponsorship: s, count }, { familyId: s.familyId, sponsorshipId: s.id });
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
