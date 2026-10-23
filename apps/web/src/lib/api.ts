import type { AdminReport, ClaimRequest, FamilyApplication, PublicFamily, SeasonSettings, SponsorPortalView, Family, Sponsorship, Sponsor, Activity, SponsorshipStatus, FamilyStatus } from '@bless/shared';

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

export type Catalog = { families: PublicFamily[]; counts: { available: number; claimed: number; fulfilled: number } };
export type AdminFamily = Family & { public: PublicFamily; sponsorship: (Sponsorship & { sponsor: Sponsor | null }) | null };
export type AdminFamilyDetail = Family & { public: PublicFamily; sponsorships: (Sponsorship & { sponsor: Sponsor | null })[]; activity: Activity[] };
export type AdminSponsorship = Sponsorship & { family: { familyId: string; nickname: string; childCount: number; slug: string; id: string } | null; sponsor: Sponsor | null };
export type AgentTurn = { conversationId: string; reply: string; actions: { tool: string; summary: string }[] };

export const api = {
  settings: () => req<SeasonSettings>('/settings'),
  catalog: () => req<Catalog>('/families'),
  family: (slug: string) => req<PublicFamily>(`/families/${slug}`),
  claimStart: (slug: string) => post<{ ok: true }>(`/families/${slug}/claim-start`),
  claim: (slug: string, body: ClaimRequest) => post<{ token: string; sponsorshipId: string; family: PublicFamily }>(`/families/${slug}/claim`, body),
  register: (body: FamilyApplication) => post<{ familyId: string }>('/register', body),
  sponsor: {
    get: (token: string) => req<SponsorPortalView>(`/sponsor/${token}`),
    status: (token: string, status: SponsorshipStatus, note = '', reason = '') => post<SponsorPortalView>(`/sponsor/${token}/status`, { status, note, reason }),
    note: (token: string, note: string) => post<SponsorPortalView>(`/sponsor/${token}/note`, { note }),
  },
  admin: {
    requestLink: (email: string) => post<{ ok: true; devLink?: string }>('/admin/auth/request', { email }),
    verify: (token: string) => post<{ ok: true; email: string }>('/admin/auth/verify', { token }),
    logout: () => post<{ ok: true }>('/admin/auth/logout'),
    me: () => req<{ email: string; assistantEnabled: boolean; store: string }>('/admin/me'),
    report: () => req<AdminReport>('/admin/report'),
    families: () => req<AdminFamily[]>('/admin/families'),
    family: (id: string) => req<AdminFamilyDetail>(`/admin/families/${id}`),
    patchFamily: (id: string, body: Partial<{ status: FamilyStatus; adminNotes: string; storyApproved: boolean; nickname: string; familyStory: string }>) => patch<AdminFamily>(`/admin/families/${id}`, body),
    sponsorships: () => req<AdminSponsorship[]>('/admin/sponsorships'),
    patchSponsorship: (id: string, body: Partial<{ status: SponsorshipStatus; adminNotes: string; flagged: boolean; flagReason: string; reason: string }>) => patch<Sponsorship>(`/admin/sponsorships/${id}`, body),
    nudge: (id: string, message?: string) => post<{ ok: boolean; subject?: string; error?: string }>(`/admin/sponsorships/${id}/nudge`, { message }),
    activity: (limit = 100) => req<Activity[]>(`/admin/activity?limit=${limit}`),
    settings: () => req<SeasonSettings>('/admin/settings'),
    patchSettings: (body: Partial<SeasonSettings>) => patch<SeasonSettings>('/admin/settings', body),
    runFollowUps: () => post<{ sent: number; flagged: number; skipped: number }>('/admin/followups/run'),
    assistant: (message: string, conversationId?: string) => post<AgentTurn>('/admin/assistant', { message, conversationId }),
    exportUrl: '/api/admin/export.csv',
  },
};
