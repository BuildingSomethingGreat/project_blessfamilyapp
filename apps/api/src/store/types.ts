import type { Activity, Child, Family, FamilyStatus, Quote, QuoteStatus, SeasonSettings, Sponsor, Sponsorship, SponsorshipStatus } from '@bless/shared';

export type NewChild = Omit<Child, 'id' | 'familyId'>;
export type NewFamily = Omit<Family, 'id' | 'children' | 'createdAt'> & { children: NewChild[] };
export type NewSponsor = Omit<Sponsor, 'id' | 'createdAt'>;
export type NewSponsorship = Omit<Sponsorship, 'id' | 'createdAt'>;
export type NewActivity = Omit<Activity, 'id'>;
export type NewQuote = Omit<Quote, 'id'>;

export interface ActivityFilter {
  since?: string;
  types?: Activity['type'][];
  familyId?: string;
  sponsorshipId?: string;
  limit?: number;
}

export interface Store {
  readonly kind: 'memory' | 'airtable';
  init(): Promise<void>;

  listFamilies(filter?: { season?: string; status?: FamilyStatus[] }): Promise<Family[]>;
  getFamily(id: string): Promise<Family | null>;
  getFamilyBySlug(slug: string): Promise<Family | null>;
  getFamilyByCode(familyId: string): Promise<Family | null>;
  createFamily(input: NewFamily): Promise<Family>;
  updateFamily(id: string, patch: Partial<Omit<Family, 'id' | 'children'>>): Promise<Family>;
  /** Stores a family photo (data URL) and returns the URL to persist. */
  storeFamilyPhoto(id: string, dataUrl: string): Promise<string>;
  incrementFamilyCounter(id: string, field: 'views' | 'claimStarts'): Promise<void>;
  nextFamilySequence(season: string): Promise<number>;

  listSponsors(): Promise<Sponsor[]>;
  getSponsor(id: string): Promise<Sponsor | null>;
  findSponsorByEmail(email: string): Promise<Sponsor | null>;
  createSponsor(input: NewSponsor): Promise<Sponsor>;
  updateSponsor(id: string, patch: Partial<Omit<Sponsor, 'id'>>): Promise<Sponsor>;

  listSponsorships(filter?: { status?: SponsorshipStatus[]; familyId?: string; sponsorId?: string }): Promise<Sponsorship[]>;
  getSponsorship(id: string): Promise<Sponsorship | null>;
  getSponsorshipByToken(token: string): Promise<Sponsorship | null>;
  getSponsorshipByCode(sponsorshipId: string): Promise<Sponsorship | null>;
  createSponsorship(input: NewSponsorship): Promise<Sponsorship>;
  updateSponsorship(id: string, patch: Partial<Omit<Sponsorship, 'id'>>): Promise<Sponsorship>;

  logActivity(input: NewActivity): Promise<Activity>;
  listActivity(filter?: ActivityFilter): Promise<Activity[]>;

  listQuotes(filter?: { status?: QuoteStatus[]; season?: string }): Promise<Quote[]>;
  createQuote(input: NewQuote): Promise<Quote>;
  updateQuote(id: string, patch: Partial<Omit<Quote, 'id'>>): Promise<Quote>;

  getSettings(): Promise<SeasonSettings>;
  updateSettings(patch: Partial<SeasonSettings>): Promise<SeasonSettings>;
}

export const DEFAULT_SETTINGS: SeasonSettings = {
  season: '2026',
  dropoffDeadline: '2026-12-14',
  dropoffLocation: 'Durfee Elementary-Middle School',
  dropoffHours: 'Monday–Friday, 10 a.m.–6 p.m.',
  contactEmail: 'sharnese@thekonnection.org',
  contactPhone: '',
  catalogOpen: true,
  registrationOpen: true,
  perChildBudgetNote: 'How much you spend is up to you. Holiday Konnectors typically spend $100–$250 per child, with the same number of gifts for each child.',
  orgDonateUrl: 'https://www.zeffy.com/en-US/donation-form/2026-holiday-bless-a-family',
  chipInsEnabled: true,
  chipInUrl: 'https://www.zeffy.com/en-US/donation-form/2026-holiday-bless-a-family',
  showPhotos: true,
  adminAlerts: true,
  alertEmails: '',
  contactName: 'Sharnese',
};
