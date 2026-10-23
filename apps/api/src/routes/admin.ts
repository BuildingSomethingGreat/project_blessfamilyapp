import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { FamilyStatusSchema, SponsorshipStatusSchema, canTransition, toPublicFamily, type SeasonSettings } from '@bless/shared';
import { z } from 'zod';
import { config } from '../config.ts';
import { isAdminEmail, loginToken, sessionToken, verifyToken, SESSION_COOKIE } from '../lib/auth.ts';
import { buildReport } from '../lib/reporting.ts';
import type { Services } from '../lib/services.ts';
import { HttpError } from '../lib/services.ts';
import { getNotifier } from '../notify/index.ts';
import { nowIso } from '../lib/ids.ts';
import { AdminAgent } from '../agent/admin-agent.ts';

type Env = { Variables: { admin: string } };

export function adminRoutes(services: Services) {
  const r = new Hono<Env>();
  const { store, followUp } = services;
  const agent = new AdminAgent(services);

  // ---- auth (magic link) ----
  r.post('/auth/request', async (c) => {
    const { email } = (await c.req.json()) as { email?: string };
    const e = String(email ?? '').trim().toLowerCase();
    // Always answer the same way so the endpoint can't be used to enumerate admins.
    if (isAdminEmail(e)) {
      const link = `${config.webUrl}/admin/login?token=${encodeURIComponent(loginToken(e))}`;
      const res = await getNotifier().sendEmail({ to: e, subject: 'Your Bless-A-Family admin sign-in link', text: `Tap to sign in (valid 15 minutes):\n${link}\n\nIf you didn't request this, ignore it.` });
      if (!config.isProd && config.notify.driver === 'console') return c.json({ ok: true, devLink: link, sent: res.ok });
    }
    return c.json({ ok: true });
  });
  r.post('/auth/verify', async (c) => {
    const { token } = (await c.req.json()) as { token?: string };
    const claims = verifyToken(token, 'login');
    if (!claims) throw new HttpError(401, 'That link is invalid or expired.');
    setCookie(c, SESSION_COOKIE, sessionToken(claims.email), { httpOnly: true, sameSite: 'Lax', secure: config.isProd, path: '/', maxAge: 14 * 86_400 });
    return c.json({ ok: true, email: claims.email });
  });
  r.post('/auth/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  r.use('*', async (c, next) => {
    if (c.req.path.includes('/auth/')) return next();
    const bearer = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const claims = verifyToken(getCookie(c, SESSION_COOKIE) ?? bearer, 'session');
    if (!claims) throw new HttpError(401, 'Sign in required');
    c.set('admin', claims.email);
    await next();
  });

  r.get('/me', (c) => c.json({ email: c.get('admin'), assistantEnabled: agent.enabled, store: store.kind }));
  r.get('/report', async (c) => c.json(await buildReport(store)));

  // ---- families ----
  r.get('/families', async (c) => {
    const settings = await store.getSettings();
    const fams = await store.listFamilies({ season: settings.season });
    const sps = await store.listSponsorships();
    const sponsors = new Map((await store.listSponsors()).map((s) => [s.id, s]));
    return c.json(
      fams
        .map((f) => {
          const active = sps.filter((s) => s.familyId === f.id && s.status !== 'Released').sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))[0];
          return { ...f, public: toPublicFamily(f), sponsorship: active ? { ...active, sponsor: sponsors.get(active.sponsorId) ?? null } : null };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  });
  r.get('/families/:id', async (c) => {
    const f = await store.getFamily(c.req.param('id'));
    if (!f) throw new HttpError(404, 'Not found');
    const sps = await store.listSponsorships({ familyId: f.id });
    const withSponsor = await Promise.all(sps.map(async (s) => ({ ...s, sponsor: await store.getSponsor(s.sponsorId) })));
    const activity = await store.listActivity({ familyId: f.id, limit: 50 });
    return c.json({ ...f, public: toPublicFamily(f), sponsorships: withSponsor, activity });
  });
  const FamilyPatch = z.object({ status: FamilyStatusSchema.optional(), adminNotes: z.string().max(5000).optional(), storyApproved: z.boolean().optional(), nickname: z.string().max(80).optional(), familyStory: z.string().max(1000).optional() });
  r.patch('/families/:id', async (c) => {
    const f = await store.getFamily(c.req.param('id'));
    if (!f) throw new HttpError(404, 'Not found');
    const patch = FamilyPatch.parse(await c.req.json());
    const full: Record<string, unknown> = { ...patch };
    if (patch.status === 'Available' && !f.approvedAt) full.approvedAt = nowIso();
    const updated = await store.updateFamily(f.id, full);
    await store.logActivity({ type: 'admin_action', channel: 'system', familyId: f.id, sponsorshipId: null, subject: `${c.get('admin')} updated ${f.familyId}`, body: '', meta: { patch, from: f.status }, occurredAt: nowIso() });
    if (patch.status === 'Available' && f.status !== 'Available') followUp.sendToFamily('family_approved', updated).catch(() => {});
    return c.json({ ...updated, public: toPublicFamily(updated) });
  });

  // ---- sponsorships ----
  r.get('/sponsorships', async (c) => {
    const sps = await store.listSponsorships();
    const [fams, sponsors] = await Promise.all([store.listFamilies(), store.listSponsors()]);
    const fm = new Map(fams.map((f) => [f.id, f]));
    const sm = new Map(sponsors.map((s) => [s.id, s]));
    return c.json(sps.map((s) => { const f = fm.get(s.familyId); return { ...s, family: f ? { familyId: f.familyId, nickname: toPublicFamily(f).nickname, childCount: f.children.length, slug: f.slug, id: f.id } : null, sponsor: sm.get(s.sponsorId) ?? null }; }).sort((a, b) => b.claimedAt.localeCompare(a.claimedAt)));
  });
  const SpPatch = z.object({ status: SponsorshipStatusSchema.optional(), adminNotes: z.string().max(5000).optional(), flagged: z.boolean().optional(), flagReason: z.string().max(300).optional(), reason: z.string().max(300).optional() });
  r.patch('/sponsorships/:id', async (c) => {
    const s = await store.getSponsorship(c.req.param('id'));
    if (!s) throw new HttpError(404, 'Not found');
    const patch = SpPatch.parse(await c.req.json());
    let out = s;
    if (patch.status && patch.status !== s.status) {
      if (!canTransition(s.status, patch.status)) throw new HttpError(409, `Can't move from ${s.status} to ${patch.status}`);
      out = await followUp.transition(s, patch.status, { actor: 'admin', reason: patch.reason });
    }
    const rest: Record<string, unknown> = {};
    if (patch.adminNotes !== undefined) rest.adminNotes = patch.adminNotes;
    if (patch.flagged !== undefined) { rest.flagged = patch.flagged; rest.flagReason = patch.flagged ? patch.flagReason ?? 'Flagged by admin' : ''; }
    if (Object.keys(rest).length) out = await store.updateSponsorship(s.id, rest);
    await store.logActivity({ type: 'admin_action', channel: 'system', familyId: s.familyId, sponsorshipId: s.id, subject: `${c.get('admin')} updated ${s.sponsorshipId}`, body: '', meta: { patch }, occurredAt: nowIso() });
    return c.json(out);
  });
  r.post('/sponsorships/:id/nudge', async (c) => {
    const s = await store.getSponsorship(c.req.param('id'));
    if (!s) throw new HttpError(404, 'Not found');
    const { message } = (await c.req.json().catch(() => ({}))) as { message?: string };
    const kind = s.status === 'Claimed' ? 'confirm_nudge' : s.status === 'Shopping' ? 'deadline_reminder' : 'shopping_checkin';
    const res = await followUp.send(kind, s, { custom: message?.trim() || undefined, actor: 'admin' });
    await store.updateSponsorship(s.id, { lastNudgedAt: nowIso(), followUpCount: s.followUpCount + 1 });
    return c.json(res);
  });

  // ---- activity / settings / export / followups ----
  r.get('/activity', async (c) => c.json(await store.listActivity({ limit: Number(c.req.query('limit') ?? 100), types: c.req.query('types')?.split(',') as any })));
  r.get('/settings', async (c) => c.json(await store.getSettings()));
  r.patch('/settings', async (c) => {
    const body = (await c.req.json()) as Partial<SeasonSettings>;
    const allowed: (keyof SeasonSettings)[] = ['season', 'dropoffDeadline', 'dropoffLocation', 'dropoffHours', 'contactEmail', 'contactPhone', 'catalogOpen', 'registrationOpen', 'perChildBudgetNote', 'orgDonateUrl'];
    const patch: Partial<SeasonSettings> = {};
    for (const k of allowed) if (k in body) (patch as any)[k] = body[k];
    return c.json(await store.updateSettings(patch));
  });
  r.post('/followups/run', async (c) => c.json(await followUp.tick()));
  r.get('/export.csv', async (c) => {
    const settings = await store.getSettings();
    const fams = await store.listFamilies({ season: settings.season });
    const sps = await store.listSponsorships();
    const sponsors = new Map((await store.listSponsors()).map((s) => [s.id, s]));
    const rows = [['Family ID', 'Nickname', 'Status', 'Guardian', 'Phone', 'Email', 'Address', 'City', 'State', 'ZIP', 'Transportation', 'Child', 'Age', 'Gender', 'Clothing Category', 'Shirt', 'Pants', 'Shoe Category', 'Shoe', 'Size Notes', 'Favorite Color', 'Hobbies', 'Clothing Wishlist', 'Other Clothing', 'Gift Types', 'Specific Gifts', 'Sponsor', 'Sponsor Email', 'Sponsorship Status']];
    for (const f of fams) {
      const s = sps.filter((x) => x.familyId === f.id && x.status !== 'Released').sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))[0];
      const sp = s ? sponsors.get(s.sponsorId) : null;
      for (const k of f.children) rows.push([f.familyId, toPublicFamily(f).nickname, f.status, f.guardianName, f.phone, f.email, f.address, f.city, f.state, f.zip, f.transportation, k.name, String(k.age), k.gender, k.clothingCategory, k.shirtSize, k.pantsSize, k.shoeCategory, k.shoeSize, k.sizeNotes, k.favoriteColor, k.hobbies, k.clothingWishlist.join('; '), k.otherClothing, k.giftTypes.join('; '), k.specificGifts, sp?.name ?? '', sp?.email ?? '', s?.status ?? '']);
    }
    const csv = rows.map((row) => row.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    return c.body(csv, 200, { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="bless-a-family-${settings.season}.csv"` });
  });

  // ---- assistant ----
  r.post('/assistant', async (c) => {
    if (!agent.enabled) throw new HttpError(503, 'Assistant is not configured. Add ANTHROPIC_API_KEY to the API environment.');
    const { conversationId, message } = (await c.req.json()) as { conversationId?: string; message?: string };
    const text = String(message ?? '').trim().slice(0, 4000);
    if (!text) throw new HttpError(400, 'Say something first.');
    return c.json(await agent.chat(conversationId, text, c.get('admin')));
  });

  return r;
}
