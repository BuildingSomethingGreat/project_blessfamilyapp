/**
 * Two state machines.
 *
 * FamilyStatus is the coarse, public-facing lifecycle of an application.
 * SponsorshipStatus is the fine-grained "dominoes" tracker for a claim —
 * it is what the follow-up agent drives.
 */
export const FAMILY_STATUSES = ['Submitted', 'Needs Info', 'Available', 'Claimed', 'Fulfilled', 'Withdrawn', 'Declined'] as const;
export type FamilyStatus = (typeof FAMILY_STATUSES)[number];

export const SPONSORSHIP_STATUSES = ['Claimed', 'Shopping', 'Purchased', 'Wrapped', 'Dropped Off', 'Delivered', 'Released'] as const;
export type SponsorshipStatus = (typeof SPONSORSHIP_STATUSES)[number];

/** Ordered dominoes — index is used for progress UI. Released is terminal/off-track. */
export const SPONSORSHIP_STEPS: { status: SponsorshipStatus; label: string; sponsorLabel: string; sub: string }[] = [
  { status: 'Claimed', label: 'Claimed', sponsorLabel: 'You claimed this family', sub: 'Your family page is live' },
  { status: 'Shopping', label: 'Shopping started', sponsorLabel: "I've started shopping", sub: 'Tap when you begin' },
  { status: 'Purchased', label: 'Gifts purchased', sponsorLabel: 'Gifts purchased', sub: 'Everything on the list is bought' },
  { status: 'Wrapped', label: 'Wrapped & labeled', sponsorLabel: 'Wrapped & labeled', sub: 'One bag per child, first name on it' },
  { status: 'Dropped Off', label: 'Dropped off at Konnection', sponsorLabel: 'Gifts dropped off', sub: 'Konnection office · by the deadline' },
  { status: 'Delivered', label: 'Delivered to family', sponsorLabel: 'Delivered to family', sub: 'We tell you the moment it lands' },
];

export const STATUS_LABEL: Record<SponsorshipStatus, string> = {
  Claimed: 'Claimed', Shopping: 'Shopping started', Purchased: 'Gifts purchased', Wrapped: 'Wrapped & labeled', 'Dropped Off': 'Dropped off at Konnection', Delivered: 'Delivered to family', Released: 'Released',
};

export const SPONSORSHIP_TRANSITIONS: Record<SponsorshipStatus, SponsorshipStatus[]> = {
  Claimed: ['Shopping', 'Purchased', 'Wrapped', 'Dropped Off', 'Released'],
  Shopping: ['Purchased', 'Wrapped', 'Dropped Off', 'Released'],
  Purchased: ['Wrapped', 'Dropped Off', 'Released'],
  Wrapped: ['Dropped Off', 'Released'],
  'Dropped Off': ['Delivered', 'Released'],
  Delivered: [],
  Released: [],
};

export function canTransition(from: SponsorshipStatus, to: SponsorshipStatus): boolean {
  return SPONSORSHIP_TRANSITIONS[from].includes(to);
}

export function stepIndex(status: SponsorshipStatus): number {
  return SPONSORSHIP_STEPS.findIndex((s) => s.status === status);
}

/** The next domino a sponsor can tap themselves (staff mark Delivered). */
export function nextSponsorStep(status: SponsorshipStatus): SponsorshipStatus | null {
  const order: SponsorshipStatus[] = ['Claimed', 'Shopping', 'Purchased', 'Wrapped', 'Dropped Off'];
  const i = order.indexOf(status);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

/** Which sponsorship statuses count as "on track" for reporting. */
export const ACTIVE_SPONSORSHIP_STATUSES: SponsorshipStatus[] = ['Claimed', 'Shopping', 'Purchased', 'Wrapped', 'Dropped Off'];
/** Statuses where the sponsor is actively working the list (check-ins apply). */
export const SHOPPING_STATUSES: SponsorshipStatus[] = ['Shopping', 'Purchased', 'Wrapped'];

/** Sponsorship status -> what the family status should be. */
export function familyStatusFor(s: SponsorshipStatus): FamilyStatus {
  if (s === 'Delivered') return 'Fulfilled';
  if (s === 'Released') return 'Available';
  return 'Claimed';
}
