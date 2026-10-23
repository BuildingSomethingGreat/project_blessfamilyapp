import type { ClothingCategory, GENDERS } from './sizes.ts';

export type Gender = (typeof GENDERS)[number];
import type { FamilyStatus, SponsorshipStatus } from './status.ts';

export interface Child {
  id: string;
  familyId: string;
  name: string;
  age: number;
  gender: Gender;
  clothingCategory: ClothingCategory;
  shirtSize: string;
  pantsSize: string;
  shoeCategory: ClothingCategory;
  shoeSize: string;
  sizeNotes: string;
  favoriteColor: string;
  hobbies: string;
  clothingWishlist: string[];
  otherClothing: string;
  giftTypes: string[];
  specificGifts: string;
  sortOrder: number;
}

/** Full family record — only ever sent to admins. */
export interface Family {
  id: string;            // store record id
  familyId: string;      // public BF-2026-014
  season: string;
  status: FamilyStatus;
  slug: string;
  nickname: string;
  guardianName: string;
  phone: string;
  email: string;
  preferredContact: 'Text' | 'Call' | 'Email';
  address: string;
  city: string;
  state: string;
  zip: string;
  transportation: 'Yes' | 'No'; // Yes = can pick up, No = needs delivery
  familyStory: string;
  storyApproved: boolean;
  photoUrl: string;        // data URL (memory) or attachment URL (Airtable); empty if none
  photoApproved: boolean;
  raised: number;          // chip-in pledges, dollars
  goal: number;            // wishlist goal, dollars
  eligibilityConfirmed: boolean;
  notes: string;
  adminNotes: string;
  views: number;
  claimStarts: number;
  createdAt: string;
  approvedAt: string | null;
  fulfilledAt: string | null;
  children: Child[];
}

/** What the public catalog sees. No guardian, no address, no surnames. */
export interface PublicChild {
  name: string; // first name only
  age: number;
  gender: Gender;
  clothingCategory: ClothingCategory;
  shirtSize: string;
  pantsSize: string;
  shoeCategory: ClothingCategory;
  shoeSize: string;
  sizeNotes: string;
  favoriteColor: string;
  hobbies: string;
  clothingWishlist: string[];
  otherClothing: string;
  giftTypes: string[];
  specificGifts: string;
}

export interface PublicFamily {
  familyId: string;
  slug: string;
  nickname: string;
  city: string;
  status: FamilyStatus;
  story: string;          // empty unless approved
  photoUrl: string;       // empty unless approved
  raised: number;
  goal: number;
  childCount: number;
  ageRange: [number, number];
  colors: string[];        // favorite colors -> card art
  tags: string[];          // derived: "Winter coats", "Teens", etc
  daysWaiting: number;
  waitLabel: string;      // 'New today' | 'Waiting 12 days'
  kidLine: string;        // '1 child' | '3 kids'
  kidNames: string;       // 'Jordan (8), Maya (5)'
  children: PublicChild[];
}

export interface Sponsor {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  preferredContact: 'Email' | 'Text' | 'Call';
  notes: string;
  createdAt: string;
}

export interface Sponsorship {
  id: string;
  sponsorshipId: string;
  familyId: string;      // store id of family
  sponsorId: string;
  status: SponsorshipStatus;
  token: string;
  claimedAt: string;
  shoppingAt: string | null;
  purchasedAt: string | null;
  wrappedAt: string | null;
  droppedOffAt: string | null;
  deliveredAt: string | null;
  releasedAt: string | null;
  nextFollowUpAt: string | null;
  lastNudgedAt: string | null;
  lastResponseAt: string | null;
  followUpCount: number;
  flagged: boolean;
  flagReason: string;
  releaseReason: string;
  sponsorNote: string;
  adminNotes: string;
  createdAt: string;
}

export type ActivityType =
  | 'catalog_view' | 'family_view' | 'claim_start' | 'claim_complete' | 'message_sent' | 'sponsor_response'
  | 'status_change' | 'admin_action' | 'agent_action' | 'flag' | 'release' | 'chip_in';

export interface Activity {
  id: string;
  type: ActivityType;
  channel: 'web' | 'email' | 'sms' | 'system';
  familyId: string | null;
  sponsorshipId: string | null;
  subject: string;
  body: string;
  meta: Record<string, unknown>;
  occurredAt: string;
}

export interface SeasonSettings {
  season: string;
  dropoffDeadline: string;     // ISO date
  dropoffLocation: string;
  dropoffHours: string;
  contactEmail: string;
  contactPhone: string;
  catalogOpen: boolean;
  registrationOpen: boolean;
  perChildBudgetNote: string;
  orgDonateUrl: string;
  chipInsEnabled: boolean;
  chipInUrl: string;       // external checkout (Zeffy/Stripe link); empty = pledge only
  showPhotos: boolean;
}

/** What a sponsor sees on their magic-link status page. */
export interface SponsorPortalView {
  sponsorship: Pick<Sponsorship, 'sponsorshipId' | 'status' | 'claimedAt' | 'shoppingAt' | 'purchasedAt' | 'wrappedAt' | 'droppedOffAt' | 'deliveredAt' | 'releasedAt' | 'sponsorNote' | 'nextFollowUpAt' | 'followUpCount' | 'flagged'>;
  sponsor: Pick<Sponsor, 'name' | 'email' | 'preferredContact'>;
  family: PublicFamily;
  settings: SeasonSettings;
  timeline: Pick<Activity, 'type' | 'subject' | 'body' | 'occurredAt' | 'channel'>[];
}

/** Admin reporting payload. */
export interface AdminReport {
  generatedAt: string;
  season: string;
  pipeline: Record<FamilyStatus, number>;
  sponsorships: Record<SponsorshipStatus, number>;
  familiesLeft: { familyId: string; nickname: string; childCount: number; daysWaiting: number; views: number; slug: string; storyApproved: boolean }[];
  followUp: {
    activeSponsorships: number;
    nudgesSent: number;
    responses: number;
    responseRate: number;          // 0..1
    medianHoursToRespond: number | null;
    overdue: { sponsorshipId: string; familyId: string; nickname: string; sponsorName: string; status: SponsorshipStatus; daysSilent: number; followUpCount: number }[];
    flagged: number;
    released: number;
    dueNext24h: number;
    staffHoursSaved: number;
  };
  matching: {
    claimsByDay: { date: string; claims: number; views: number }[];
    medianHoursToClaim: number | null;
    claimRateBySize: { size: string; available: number; claimed: number; rate: number }[];
    topViewedUnclaimed: { familyId: string; nickname: string; views: number; claimStarts: number; slug: string }[];
    totalRaised: number;
    catalogViews: number;
    familyViews: number;
    claimStarts: number;
    claimCompletes: number;
  };
  children: { total: number; byAgeBand: { band: string; count: number }[]; needingCoats: number; needingBoots: number };
  deadline: { dropoffDeadline: string; daysLeft: number };
}
