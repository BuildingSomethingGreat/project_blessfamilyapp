import type { Activity, Child, Family, FamilyStatus, SeasonSettings, Sponsor, Sponsorship, SponsorshipStatus } from '@bless/shared';

export type NewChild = Omit<Child, 'id' | 'familyId'>;
export type NewFamily = Omit<Family, 'id' | 'children' | 'createdAt'> & { children: NewChild[] };
export type NewSponsor = Omit<Sponsor, 'id' | 'createdAt'>;
export type NewSponsorship = Omit<Sponsorship, 'id' | 'createdAt'>;
export type NewActivity = Omit<Activity, 'id'>;

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
  incrementFamilyCounter(id: string, field: 'views' | 'claimStarts'): Promise<void>;
  nextFamilySequence(season: string): Promise<number>;

  listSponsors(): Promise<Sponsor[]>;
  getSponsor(id: string): Promise<Sponsor | null>;
  findSponsorByEmail(email: string): Promise<Sponsor | null>;
  createSponsor(input: NewSponsor): Promise<Sponsor>;

  listSponsorships(filter?: { status?: SponsorshipStatus[]; familyId?: string; sponsorId?: string }): Promise<Sponsorship[]>;
  getSponsorship(id: string): Promise<Sponsorship | null>;
  getSponsorshipByToken(token: string): Promise<Sponsorship | null>;
  getSponsorshipByCode(sponsorshipId: string): Promise<Sponsorship | null>;
  createSponsorship(input: NewSponsorship): Promise<Sponsorship>;
  updateSponsorship(id: string, patch: Partial<Omit<Sponsorship, 'id'>>): Promise<Sponsorship>;

  logActivity(input: NewActivity): Promise<Activity>;
  listActivity(filter?: ActivityFilter): Promise<Activity[]>;

  getSettings(): Promise<SeasonSettings>;
  updateSettings(patch: Partial<SeasonSettings>): Promise<SeasonSettings>;
}

export const DEFAULT_SETTINGS: SeasonSettings = {
  season: '2026',
  dropoffDeadline: '2026-12-12',
  dropoffLocation: 'The Konnection office',
  dropoffHours: 'Mon–Fri, 10am–6pm',
  contactEmail: 'info@thekonnection.org',
  contactPhone: '',
  catalogOpen: true,
  registrationOpen: true,
  perChildBudgetNote: 'Most sponsors spend $75–$150 per child. Every item under $100.',
  orgDonateUrl: 'https://thekonnection.org',
};
