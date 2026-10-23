import { ACTIVE_SPONSORSHIP_STATUSES, FAMILY_STATUSES, SPONSORSHIP_STATUSES, toPublicFamily, type AdminReport, type FamilyStatus, type SponsorshipStatus } from '@bless/shared';
import type { Store } from '../store/types.ts';
import { daysToDeadline } from '../followup/engine.ts';

const D = 86_400_000;
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export async function buildReport(store: Store, now = new Date()): Promise<AdminReport> {
  const settings = await store.getSettings();
  const [families, sponsorships, sponsors, activity] = await Promise.all([
    store.listFamilies({ season: settings.season }),
    store.listSponsorships(),
    store.listSponsors(),
    store.listActivity({ since: new Date(now.getTime() - 60 * D).toISOString() }),
  ]);
  const famById = new Map(families.map((f) => [f.id, f]));
  const sponsorById = new Map(sponsors.map((s) => [s.id, s]));
  const seasonSponsorships = sponsorships.filter((s) => famById.has(s.familyId));

  const pipeline = Object.fromEntries(FAMILY_STATUSES.map((s) => [s, 0])) as Record<FamilyStatus, number>;
  for (const f of families) pipeline[f.status]++;
  const sp = Object.fromEntries(SPONSORSHIP_STATUSES.map((s) => [s, 0])) as Record<SponsorshipStatus, number>;
  for (const s of seasonSponsorships) sp[s.status]++;

  const familiesLeft = families
    .filter((f) => f.status === 'Available')
    .map((f) => {
      const p = toPublicFamily(f, now);
      return { familyId: f.familyId, nickname: p.nickname, childCount: f.children.length, daysWaiting: p.daysWaiting, views: f.views, slug: f.slug, storyApproved: f.storyApproved };
    })
    .sort((a, b) => b.daysWaiting - a.daysWaiting);

  // Follow-up metrics
  const nudges = activity.filter((a) => a.type === 'message_sent' && a.sponsorshipId && ['confirm_nudge', 'shopping_checkin', 'deadline_reminder'].includes(String(a.meta?.kind)));
  const responses = activity.filter((a) => a.type === 'sponsor_response');
  const respondedAfterNudge: number[] = [];
  for (const n of nudges) {
    const r = responses.filter((x) => x.sponsorshipId === n.sponsorshipId && x.occurredAt > n.occurredAt).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];
    if (r) respondedAfterNudge.push((new Date(r.occurredAt).getTime() - new Date(n.occurredAt).getTime()) / 3_600_000);
  }
  const active = seasonSponsorships.filter((s) => ACTIVE_SPONSORSHIP_STATUSES.includes(s.status));
  const overdue = active
    .map((s) => {
      const last = s.lastResponseAt ?? s.claimedAt;
      const daysSilent = Math.floor((now.getTime() - new Date(last).getTime()) / D);
      const f = famById.get(s.familyId)!;
      return { sponsorshipId: s.sponsorshipId, familyId: f.familyId, nickname: toPublicFamily(f, now).nickname, sponsorName: sponsorById.get(s.sponsorId)?.name ?? '—', status: s.status, daysSilent, followUpCount: s.followUpCount, flagged: s.flagged };
    })
    .filter((x) => x.daysSilent >= 3 || x.flagged)
    .sort((a, b) => b.daysSilent - a.daysSilent);
  const dueNext24h = active.filter((s) => s.nextFollowUpAt && new Date(s.nextFollowUpAt).getTime() - now.getTime() < D).length;

  // Matching
  const claimsAll = activity.filter((a) => a.type === 'claim_complete');
  const byDay = new Map<string, { claims: number; views: number }>();
  for (let i = 29; i >= 0; i--) byDay.set(new Date(now.getTime() - i * D).toISOString().slice(0, 10), { claims: 0, views: 0 });
  for (const a of activity) {
    const k = a.occurredAt.slice(0, 10);
    const row = byDay.get(k);
    if (!row) continue;
    if (a.type === 'claim_complete') row.claims++;
    if (a.type === 'family_view') row.views++;
  }
  const hoursToClaim = seasonSponsorships
    .map((s) => {
      const f = famById.get(s.familyId);
      const start = f?.approvedAt ?? f?.createdAt;
      return start ? (new Date(s.claimedAt).getTime() - new Date(start).getTime()) / 3_600_000 : null;
    })
    .filter((x): x is number => x !== null && x >= 0);
  const sizeBucket = (n: number) => (n === 1 ? '1 child' : n === 2 ? '2 kids' : n === 3 ? '3 kids' : '4+ kids');
  const sizes = new Map<string, { available: number; claimed: number }>();
  for (const b of ['1 child', '2 kids', '3 kids', '4+ kids']) sizes.set(b, { available: 0, claimed: 0 });
  for (const f of families) {
    if (!['Available', 'Claimed', 'Fulfilled'].includes(f.status)) continue;
    const row = sizes.get(sizeBucket(f.children.length))!;
    if (f.status === 'Available') row.available++;
    else row.claimed++;
  }
  const claimRateBySize = [...sizes.entries()].map(([size, v]) => ({ size, ...v, rate: v.available + v.claimed ? v.claimed / (v.available + v.claimed) : 0 }));
  const topViewedUnclaimed = families
    .filter((f) => f.status === 'Available')
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((f) => ({ familyId: f.familyId, nickname: toPublicFamily(f, now).nickname, views: f.views, claimStarts: f.claimStarts, slug: f.slug }));

  const kids = families.filter((f) => f.status !== 'Declined' && f.status !== 'Withdrawn').flatMap((f) => f.children);
  const bands = [
    ['0–1', (a: number) => a < 2], ['2–4', (a: number) => a >= 2 && a < 5], ['5–9', (a: number) => a >= 5 && a < 10], ['10–12', (a: number) => a >= 10 && a < 13], ['13–17', (a: number) => a >= 13],
  ] as const;

  return {
    generatedAt: now.toISOString(),
    season: settings.season,
    pipeline,
    sponsorships: sp,
    familiesLeft,
    followUp: {
      activeSponsorships: active.length,
      nudgesSent: nudges.length,
      responses: responses.length,
      responseRate: nudges.length ? Math.min(1, respondedAfterNudge.length / nudges.length) : 0,
      medianHoursToRespond: median(respondedAfterNudge),
      overdue: overdue.map(({ flagged, ...rest }) => rest),
      flagged: active.filter((s) => s.flagged).length,
      released: seasonSponsorships.filter((s) => s.status === 'Released').length,
      dueNext24h,
      staffHoursSaved: Math.round((nudges.length * 10) / 60 * 10) / 10,
    },
    matching: {
      claimsByDay: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
      medianHoursToClaim: median(hoursToClaim),
      claimRateBySize,
      topViewedUnclaimed,
      catalogViews: activity.filter((a) => a.type === 'catalog_view').length,
      familyViews: activity.filter((a) => a.type === 'family_view').length,
      claimStarts: activity.filter((a) => a.type === 'claim_start').length,
      claimCompletes: claimsAll.length,
      totalRaised: families.reduce((a, f) => a + (f.raised ?? 0), 0),
    },
    children: {
      total: kids.length,
      byAgeBand: bands.map(([band, fn]) => ({ band, count: kids.filter((k) => fn(k.age)).length })),
      needingCoats: kids.filter((k) => k.clothingWishlist.includes('Winter Coat')).length,
      needingBoots: kids.filter((k) => k.clothingWishlist.includes('Boots')).length,
    },
    deadline: { dropoffDeadline: settings.dropoffDeadline, daysLeft: daysToDeadline(settings, now) },
  };
}
