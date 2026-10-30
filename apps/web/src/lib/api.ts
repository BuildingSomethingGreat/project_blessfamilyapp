import type { AdminReport, ChipIn, ClaimRequest, CommunityView, FamilyApplication, PublicFamily, Quote, QuoteRole, QuoteStatus, QuoteSubmit, SeasonSettings, SponsorPortalView, Family, Sponsorship, Sponsor, Activity, SponsorshipStatus, FamilyStatus } from '@bless/shared';

export class ApiError extends Error {
  constructor(public status: number, message: string, public issues?: unknown) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`, body?.issues);
  return body as T;
}
const post = <T,>(path: string, body?: unknown) => req<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T,>(path: string, body: unknown) => req<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export type Catalog = { families: PublicFamily[]; counts: { available: number; claimed: number; fulfilled: number; kids: number } };
export type AdminFamily = Family & { public: PublicFamily; sponsorship: (Sponsorship & { sponsor: Sponsor | null }) | null };
export type AdminFamilyDetail = Family & { public: PublicFamily; sponsorships: (Sponsorship & { sponsor: Sponsor | null })[]; activity: Activity[] };
export type AdminSponsorship = Sponsorship & { family: { familyId: string; nickname: string; childCount: number; slug: string; id: string } | null; sponsor: Sponsor | null };
export type WallAdminRow = { id: string; name: string; email: string; organization: string; displayName: string; publicName: string; wallOptIn: boolean; wallHidden: boolean; active: number; done: number; showing: boolean };
export type AccountFamily = { token: string; sponsorshipId: string; status: SponsorshipStatus; handoff: string; claimedAt: string; nickname: string; kidLine: string; kidNames: string; colors: string[] };
export type AccountMe = { sponsor: { name: string; email: string; phone: string; organization: string; displayName: string; wallOptIn: boolean }; families: AccountFamily[] };
export type EmailLogRow = { id: string; at: string; subject: string; body: string; kind: string; to: string; ok: boolean; error: string | null; provider: string; actor: string; audience: 'konnector' | 'family' | 'admin' | 'test'; family: { id: string; familyId: string; nickname: string } | null; sponsorshipId: string | null };
export type AgentTurn = { conversationId: string; reply: string; actions: { tool: string; summary: string }[] };

/** The sponsor's magic-link token lives on the device so "My family page" works without sign-in. */
export const SPONSOR_TOKEN_KEY = 'baf-sponsor-token';
export const getSponsorToken = () => { try { return localStorage.getItem(SPONSOR_TOKEN_KEY); } catch { return null; } };
export const setSponsorToken = (t: string | null) => { try { t ? localStorage.setItem(SPONSOR_TOKEN_KEY, t) : localStorage.removeItem(SPONSOR_TOKEN_KEY); } catch { /* ignore */ } };

export const api = {
  settings: () => req<SeasonSettings>('/settings'),
  catalog: () => req<Catalog>('/families'),
  family: (slug: string) => req<PublicFamily>(`/families/${slug}`),
  claimStart: (slug: string) => post<{ ok: true }>(`/families/${slug}/claim-start`),
  claim: (slug: string, body: ClaimRequest) => post<{ token: string; sponsorshipId: string; family: PublicFamily }>(`/families/${slug}/claim`, body),
  chipIn: (slug: string, body: ChipIn) => post<{ checkoutUrl: string; total: number; family: PublicFamily }>(`/families/${slug}/chip-in`, body),
  register: (body: FamilyApplication) => post<{ familyId: string }>('/register', body),
  community: () => req<CommunityView>('/community'),
  submitQuote: (body: QuoteSubmit) => post<{ ok: true }>('/quotes', body),
  account: {
    login: (email: string) => post<{ ok: true; devLink?: string }>('/account/login', { email }),
    verify: (token: string) => post<{ ok: true }>('/account/verify', { token }),
    me: () => req<AccountMe>('/account/me'),
    logout: () => post<{ ok: true }>('/account/logout'),
  },
  sponsor: {
    get: (token: string) => req<SponsorPortalView>(`/sponsor/${token}`),
    status: (token: string, status: SponsorshipStatus, note = '', reason = '') => post<SponsorPortalView>(`/sponsor/${token}/status`, { status, note, reason }),
    note: (token: string, note: string) => post<SponsorPortalView>(`/sponsor/${token}/note`, { note }),
    wall: (token: string, optIn: boolean, displayName: string) => post<SponsorPortalView>(`/sponsor/${token}/wall`, { optIn, displayName }),
  },
  admin: {
    requestLink: (email: string) => post<{ ok: true; devLink?: string; passcodeEnabled?: boolean; emailConfigured?: boolean }>('/admin/auth/request', { email }),
    passcode: (email: string, passcode: string) => post<{ ok: true; email: string }>('/admin/auth/passcode', { email, passcode }),
    verify: (token: string) => post<{ ok: true; email: string }>('/admin/auth/verify', { token }),
    logout: () => post<{ ok: true }>('/admin/auth/logout'),
    me: () => req<{ email: string; assistantEnabled: boolean; store: string; mail: { provider: 'resend' | 'console'; from: string }; adminEmails: string[] }>('/admin/me'),
    report: () => req<AdminReport>('/admin/report'),
    families: () => req<AdminFamily[]>('/admin/families'),
    family: (id: string) => req<AdminFamilyDetail>(`/admin/families/${id}`),
    patchFamily: (id: string, body: Partial<{ status: FamilyStatus; adminNotes: string; storyApproved: boolean; photoApproved: boolean; photoPrivate: boolean; nickname: string; familyStory: string; goal: number }>) => patch<AdminFamily>(`/admin/families/${id}`, body),
    sponsorships: () => req<AdminSponsorship[]>('/admin/sponsorships'),
    patchSponsorship: (id: string, body: Partial<{ status: SponsorshipStatus; handoff: 'Drop off' | 'Deliver directly'; adminNotes: string; flagged: boolean; flagReason: string; reason: string }>) => patch<Sponsorship>(`/admin/sponsorships/${id}`, body),
    nudge: (id: string, message?: string) => post<{ ok: boolean; subject?: string; text?: string; error?: string }>(`/admin/sponsorships/${id}/nudge`, { message }),
    emailFamily: (id: string, message: string) => post<{ ok: boolean; subject?: string; error?: string }>(`/admin/families/${id}/email`, { message }),
    emails: (limit = 400) => req<EmailLogRow[]>(`/admin/emails?limit=${limit}`),
    testEmail: (to: string) => post<{ ok: boolean; error?: string; id?: string; provider: string }>('/admin/emails/test', { to }),
    activity: (limit = 100) => req<Activity[]>(`/admin/activity?limit=${limit}`),
    settings: () => req<SeasonSettings>('/admin/settings'),
    patchSettings: (body: Partial<SeasonSettings>) => patch<SeasonSettings>('/admin/settings', body),
    runFollowUps: () => post<{ sent: number; flagged: number; skipped: number }>('/admin/followups/run'),
    assistant: (message: string, conversationId?: string) => post<AgentTurn>('/admin/assistant', { message, conversationId }),
    quotes: () => req<Quote[]>('/admin/quotes'),
    addQuote: (body: { quote: string; name: string; role: QuoteRole; organization?: string; featured?: boolean }) => post<Quote>('/admin/quotes', body),
    patchQuote: (id: string, body: Partial<{ status: QuoteStatus; featured: boolean; quote: string; name: string; organization: string; role: QuoteRole }>) => patch<Quote>(`/admin/quotes/${id}`, body),
    wall: () => req<WallAdminRow[]>('/admin/wall'),
    patchSponsor: (id: string, body: Partial<{ wallHidden: boolean; wallOptIn: boolean; displayName: string }>) => patch<Sponsor>(`/admin/sponsors/${id}`, body),
    exportUrl: '/api/admin/export.csv',
    sponsorsCsvUrl: '/api/admin/sponsors.csv',
  },
};

/** Konnection photography used on the landing page (from thekonnection.org). Swap for local files in /public/photos when available. */
export const PHOTOS = {
  /** Landing hero band (wide crop of a portrait photo, so `position` keeps the faces in frame). */
  hero: { src: '/photos/campaign/basketball.webp', alt: 'Two smiling kids with their new gifts at last season’s Bless-a-Family hand-out', position: '50% 24%' },
  stats: 'https://static.wixstatic.com/media/96402c_66b742f7eaa248e4b2a0c7fb5a765099~mv2.png/v1/fill/w_826,h_836,al_c,q_90,enc_auto/p.png',
  /** Kids with their gifts at the last Bless-a-Family hand-out (shared by The Konnection). */
  campaign: [
    { src: '/photos/campaign/gel-blaster.webp', alt: 'A smiling boy in reindeer antlers holds up his new gel blaster' },
    { src: '/photos/campaign/magnetic-tiles.webp', alt: 'A girl in green antlers shows off a box of magnetic building tiles' },
    { src: '/photos/campaign/basketball.webp', alt: 'A grinning child hugs a new basketball' },
    { src: '/photos/campaign/x-shot.webp', alt: 'Two boys with their new X-Shot blasters' },
  ],
  partners: 'https://static.wixstatic.com/media/96402c_623f4099fb02422d94558eca14fb2f9d~mv2.png/v1/crop/x_1,y_0,w_2897,h_555/fill/w_979,h_187,al_c,q_85,enc_auto/sponsors.png',
};
