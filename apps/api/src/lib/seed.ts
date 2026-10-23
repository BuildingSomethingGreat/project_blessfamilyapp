import type { Store } from '../store/types.ts';
import { deriveNickname } from '@bless/shared';
import { familyCode, shortId, token, nowIso } from './ids.ts';
import { SEED_HOUSEHOLDS, SEED_SPONSORS, SEED_SPONSORSHIPS } from './seed-data.ts';

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const maybe = (d: number | null) => (d === null ? null : daysAgo(d));

/** Loads the realistic test households, sponsors, sponsorships and activity into any Store. */
export async function seedDemo(store: Store) {
  const season = (await store.getSettings()).season || '2026';
  const sponsors = [];
  for (const s of SEED_SPONSORS) sponsors.push(await store.createSponsor(s));

  const families = [];
  let seq = 1;
  for (const h of SEED_HOUSEHOLDS) {
    const code = familyCode(season, seq++);
    const kids = h.kids.map((k, i) => ({ ...k, sortOrder: i }));
    const approvedAt = ['Submitted', 'Needs Info'].includes(h.status) ? null : daysAgo(Math.max(0, h.createdDaysAgo - 1));
    const fam = await store.createFamily({
      familyId: code, season, status: h.status, slug: shortId(), nickname: deriveNickname(kids.map((k) => ({ ...k, id: '', familyId: '' })), code),
      guardianName: h.guardian, phone: h.phone, email: h.email, preferredContact: h.preferredContact, address: h.address, city: h.city, state: 'MI', zip: h.zip,
      transportation: h.transportation, familyStory: h.story, storyApproved: h.storyApproved && !!h.story, photoUrl: '', photoApproved: false,
      raised: h.raised ?? 0, goal: 150 * kids.length, eligibilityConfirmed: true, notes: h.notes ?? '', adminNotes: '', views: h.views, claimStarts: h.claimStarts,
      approvedAt, fulfilledAt: h.status === 'Fulfilled' ? daysAgo(3) : null, children: kids,
    });
    await store.updateFamily(fam.id, { createdAt: daysAgo(h.createdDaysAgo) } as any);
    families.push(fam);
    for (let v = 0; v < Math.min(h.views, 12); v++) {
      await store.logActivity({ type: 'family_view', channel: 'web', familyId: fam.id, sponsorshipId: null, subject: 'Viewed', body: '', meta: {}, occurredAt: daysAgo(Math.random() * Math.max(1, h.createdDaysAgo)) });
    }
    for (let c = 0; c < Math.min(h.claimStarts, 4); c++) {
      await store.logActivity({ type: 'claim_start', channel: 'web', familyId: fam.id, sponsorshipId: null, subject: 'Started claim', body: '', meta: {}, occurredAt: daysAgo(Math.random() * Math.max(1, h.createdDaysAgo)) });
    }
    if (h.raised) await store.logActivity({ type: 'chip_in', channel: 'web', familyId: fam.id, sponsorshipId: null, subject: `$${h.raised} chip-in toward ${code}`, body: '', meta: { amount: h.raised }, occurredAt: daysAgo(2) });
  }

  let n = 1;
  for (const s of SEED_SPONSORSHIPS) {
    const fam = families[s.householdIdx];
    const sp = sponsors[s.sponsorIdx];
    const claimedAt = daysAgo(s.claimedDaysAgo);
    const after = (status: string, offset: number) => (['Shopping', 'Purchased', 'Wrapped', 'Dropped Off', 'Delivered'].indexOf(s.status) >= ['Shopping', 'Purchased', 'Wrapped', 'Dropped Off', 'Delivered'].indexOf(status) ? daysAgo(Math.max(0, s.claimedDaysAgo - offset)) : null);
    const ss = await store.createSponsorship({
      sponsorshipId: `SP-${season}-${String(n++).padStart(3, '0')}`, familyId: fam.id, sponsorId: sp.id, token: token(), claimedAt, status: s.status,
      shoppingAt: after('Shopping', 2), purchasedAt: after('Purchased', 4), wrappedAt: after('Wrapped', 6), droppedOffAt: after('Dropped Off', 9), deliveredAt: after('Delivered', 12), releasedAt: null,
      nextFollowUpAt: s.status === 'Delivered' || s.flagged ? null : s.status === 'Shopping' ? daysAgo(0.5) : daysAgo(-3), lastNudgedAt: maybe(s.lastNudgedDaysAgo), lastResponseAt: maybe(s.lastResponseDaysAgo), followUpCount: s.followUpCount,
      flagged: !!s.flagged, flagReason: s.flagged ? `No response after ${s.followUpCount} follow-ups` : '', releaseReason: '', sponsorNote: s.note ?? '', adminNotes: '',
    });
    await store.logActivity({ type: 'claim_complete', channel: 'web', familyId: fam.id, sponsorshipId: ss.id, subject: `${sp.name} claimed ${fam.familyId}`, body: '', meta: {}, occurredAt: claimedAt });
    await store.logActivity({ type: 'message_sent', channel: 'email', familyId: fam.id, sponsorshipId: ss.id, subject: `You're blessing a family this holiday`, body: '', meta: { kind: 'claim_confirmation' }, occurredAt: claimedAt });
    if (s.lastNudgedDaysAgo !== null) {
      await store.logActivity({ type: 'message_sent', channel: sp.preferredContact === 'Text' ? 'sms' : 'email', familyId: fam.id, sponsorshipId: ss.id, subject: s.status === 'Claimed' ? 'Quick check-in: are you still in?' : "How's shopping going?", body: '', meta: { kind: s.status === 'Claimed' ? 'confirm_nudge' : 'shopping_checkin' }, occurredAt: daysAgo(s.lastNudgedDaysAgo) });
    }
    if (s.lastResponseDaysAgo !== null) {
      await store.logActivity({ type: 'sponsor_response', channel: 'web', familyId: fam.id, sponsorshipId: ss.id, subject: `Sponsor marked: ${s.status}`, body: s.note ?? '', meta: {}, occurredAt: daysAgo(s.lastResponseDaysAgo) });
    }
    if (s.flagged) await store.logActivity({ type: 'flag', channel: 'system', familyId: fam.id, sponsorshipId: ss.id, subject: 'Flagged for admin: unresponsive sponsor', body: '', meta: { followUpCount: s.followUpCount }, occurredAt: daysAgo(1) });
    if (s.status === 'Delivered') await store.logActivity({ type: 'message_sent', channel: 'email', familyId: fam.id, sponsorshipId: ss.id, subject: 'Delivered 💛', body: '', meta: { kind: 'delivered_thanks' }, occurredAt: daysAgo(Math.max(0, s.claimedDaysAgo - 12)) });
  }
  for (let i = 0; i < 80; i++) {
    await store.logActivity({ type: 'catalog_view', channel: 'web', familyId: null, sponsorshipId: null, subject: '', body: '', meta: {}, occurredAt: daysAgo(Math.random() * 30) });
  }
  await store.updateSettings({ season });
  console.log(`[seed] ${families.length} households, ${sponsors.length} sponsors, ${SEED_SPONSORSHIPS.length} sponsorships loaded at ${nowIso()}`);
}
