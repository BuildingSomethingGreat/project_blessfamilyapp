/**
 * Two state machines.
 *
 * FamilyStatus is the coarse, public-facing lifecycle of an application.
 * SponsorshipStatus is the fine-grained "dominoes" tracker for a claim —
 * it is what the follow-up agent drives.
 */
export const FAMILY_STATUSES = ['Submitted', 'Needs Info', 'Available', 'Claimed', 'Fulfilled', 'Withdrawn', 'Declined'] as const;
export type FamilyStatus = (typeof FAMILY_STATUSES)[number];

export const SPONSORSHIP_STATUSES = ['Claimed', 'Confirmed', 'Shopping', 'Dropped Off', 'Delivered', 'Released'] as const;
export type SponsorshipStatus = (typeof SPONSORSHIP_STATUSES)[number];

/** Ordered dominoes — index is used for progress UI. Released is terminal/off-track. */
export const SPONSORSHIP_STEPS: { status: SponsorshipStatus; label: string; sponsorLabel: string; description: string }[] = [
  { status: 'Claimed', label: 'Claimed', sponsorLabel: 'You claimed this family', description: 'Sponsor picked the family. Waiting on confirmation.' },
  { status: 'Confirmed', label: 'Confirmed', sponsorLabel: "I'm in", description: 'Sponsor confirmed they will follow through.' },
  { status: 'Shopping', label: 'Shopping', sponsorLabel: "I've started shopping", description: 'Gifts are being purchased.' },
  { status: 'Dropped Off', label: 'Dropped off', sponsorLabel: 'Gifts dropped off', description: 'Gifts delivered to The Konnection.' },
  { status: 'Delivered', label: 'Delivered', sponsorLabel: 'Delivered to family', description: 'The Konnection delivered gifts to the family.' },
];

export const SPONSORSHIP_TRANSITIONS: Record<SponsorshipStatus, SponsorshipStatus[]> = {
  Claimed: ['Confirmed', 'Shopping', 'Dropped Off', 'Released'],
  Confirmed: ['Shopping', 'Dropped Off', 'Released'],
  Shopping: ['Dropped Off', 'Released'],
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

/** Which sponsorship statuses count as "on track" for reporting. */
export const ACTIVE_SPONSORSHIP_STATUSES: SponsorshipStatus[] = ['Claimed', 'Confirmed', 'Shopping', 'Dropped Off'];

/** Sponsorship status -> what the family status should be. */
export function familyStatusFor(s: SponsorshipStatus): FamilyStatus {
  if (s === 'Delivered') return 'Fulfilled';
  if (s === 'Released') return 'Available';
  return 'Claimed';
}
