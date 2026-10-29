import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { FamilyStatusSchema, HANDOFFS, nicknameProblem, QUOTE_ROLES, QUOTE_STATUSES, SponsorshipStatusSchema, canTransition, toPublicFamily, type SeasonSettings } from '@bless/shared';
import { z } from 'zod';
import { config } from '../config.ts';
import { isAdminEmail, loginToken, sessionToken, verifyToken, SESSION_COOKIE } from '../lib/auth.ts';
import { buildReport } from '../lib/reporting.ts';
import type { Services } from '../lib/services.ts';
import { HttpError, wallName } from '../lib/services.ts';
import { parseEmails } from '../notify/mailer.ts';
import { adminAlert, adminLoginEmail, testEmail } from '../followup/messages.ts';
import { nowIso } from '../lib/ids.ts';
import { AdminAgent } from '../agent/admin-agent.ts';

type Env = { Variables: { admin: string } };

/** Quoted CSV. Cells that a spreadsheet would run as a formula (public form input) get a leading apostrophe. */
const toCsv = (rows: string[][]) =>
  rows.map((row) => row.map((v) => {
    const t = String(v ?? '');
    const safe = /^[=@\t\r]|^[+-][^\d\s(]/.test(t) ? `'${t}` : t;
    return '"' + safe.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');

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
      const m = adminLoginEmail(link);
      const res = await services.mailer.send({ to: e, subject: m.subject, spec: m.spec, kind: 'admin_login', audience: 'admin', logBody: 'Admin sign-in link (hidden from the log).' });
      if (!config.isProd && config.notify.driver === 'console') return c.json({ ok: true, devLink: link, sent: res.ok, passcodeEnabled: !!config.adminPasscode });
    }
    return c.json({ ok: true, passcodeEnabled: !!config.adminPasscode, emailConfigured: config.notify.driver !== 'console' });
  });
  /** Fallback sign-in with a shared passcode (ADMIN_PASSCODE) for teams without an email provider yet. */
  r.post('/auth/passcode', async (c) => {
    const { email, passcode } = (await c.req.json()) as { email?: string; passcode?: string };
    const e = String(email ?? '').trim().toLowerCase();
    const ok = !!config.adminPasscode && String(passcode ?? '') === config.adminPasscode && isAdminEmail(e);
    if (!ok) throw new HttpError(401, 'That email and passcode combination is not valid.');
    setCookie(c, SESSION_COOKIE, sessionToken(e), { httpOnly: true, sameSite: 'Lax', secure: config.isProd, path: '/', maxAge: 14 * 86_400 });
    return c.json({ ok: true, email: e });
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

  r.get('/me', (c) => c.json({ email: c.get('admin'), assistantEnabled: agent.enabled, store: store.kind, mail: { provider: config.notify.driver, from: config.notify.from }, adminEmails: config.adminEmails }));
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
  const FamilyPatch = z.object({ status: FamilyStatusSchema.optional(), adminNotes: z.string().max(5000).optional(), storyApproved: z.boolean().optional(), photoApproved: z.boolean().optional(), photoPrivate: z.boolean().optional(), nickname: z.string().max(80).optional(), familyStory: z.string().max(1000).optional(), goal: z.number().int().min(0).max(100000).optional() });
  r.patch('/families/:id', async (c) => {
    const f = await store.getFamily(c.req.param('id'));
    if (!f) throw new HttpError(404, 'Not found');
    const patch = FamilyPatch.parse(await c.req.json());
    if (patch.nickname !== undefined) {
      patch.nickname = patch.nickname.trim();
      const issue = patch.nickname ? nicknameProblem(patch.nickname, { guardianName: f.guardianName, childNames: f.children.map((k) => k.name) }) : null;
      if (issue) throw new HttpError(400, issue);
    }
    const full: Record<string, unknown> = { ...patch };
    if (patch.status === 'Available' && !f.approvedAt) full.approvedAt = nowIso();
    const updated = await store.updateFamily(f.id, full);
    await store.logActivity({ type: 'admin_action', channel: 'system', familyId: f.id, sponsorshipId: null, subject: `${c.get('admin')} updated ${f.familyId}`, body: '', meta: { patch, from: f.status }, occurredAt: nowIso() });
    if (patch.status === 'Available' && f.status !== 'Available') await followUp.sendToFamily('family_approved', updated, { actor: 'admin' }).catch(() => {});
    return c.json({ ...updated, public: toPublicFamily(updated) });
  });
  r.post('/families/:id/email', async (c) => {
    const f = await store.getFamily(c.req.param('id'));
    if (!f) throw new HttpError(404, 'Not found');
    const { message } = z.object({ message: z.string().trim().min(2).max(2000) }).parse(await c.req.json());
    return c.json(await followUp.sendToFamily('family_note', f, { custom: message, actor: 'admin' }));
  });

  // ---- sponsorships ----
  r.get('/sponsorships', async (c) => {
    const sps = await store.listSponsorships();
    const [fams, sponsors] = await Promise.all([store.listFamilies(), store.listSponsors()]);
    const fm = new Map(fams.map((f) => [f.id, f]));
    const sm = new Map(sponsors.map((s) => [s.id, s]));
    return c.json(sps.map((s) => { const f = fm.get(s.familyId); return { ...s, family: f ? { familyId: f.familyId, nickname: toPublicFamily(f).nickname, childCount: f.children.length, slug: f.slug, id: f.id } : null, sponsor: sm.get(s.sponsorId) ?? null }; }).sort((a, b) => b.claimedAt.localeCompare(a.claimedAt)));
  });
  const SpPatch = z.object({ status: SponsorshipStatusSchema.optional(), handoff: z.enum(HANDOFFS).optional(), adminNotes: z.string().max(5000).optional(), flagged: z.boolean().optional(), flagReason: z.string().max(300).optional(), reason: z.string().max(300).optional() });
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
    if (patch.handoff) rest.handoff = patch.handoff;
    if (patch.flagged !== undefined) { rest.flagged = patch.flagged; rest.flagReason = patch.flagged ? patch.flagReason ?? 'Flagged by admin' : ''; }
    if (Object.keys(rest).length) out = await store.updateSponsorship(s.id, rest);
    await store.logActivity({ type: 'admin_action', channel: 'system', familyId: s.familyId, sponsorshipId: s.id, subject: `${c.get('admin')} updated ${s.sponsorshipId}`, body: '', meta: { patch }, occurredAt: nowIso() });
    return c.json(out);
  });
  r.post('/sponsorships/:id/nudge', async (c) => {
    const s = await store.getSponsorship(c.req.param('id'));
    if (!s) throw new HttpError(404, 'Not found');
    const { message } = (await c.req.json().catch(() => ({}))) as { message?: string };
    const kind = s.status === 'Claimed' ? 'confirm_nudge' : 'shopping_checkin';
    const res = await followUp.send(kind, s, { custom: message?.trim() || undefined, actor: 'admin' });
    await store.updateSponsorship(s.id, { lastNudgedAt: nowIso(), followUpCount: s.followUpCount + 1 });
    return c.json(res);
  });

  // ---- activity / settings / export / followups ----
  r.get('/activity', async (c) => c.json(await store.listActivity({ limit: Number(c.req.query('limit') ?? 100), types: c.req.query('types')?.split(',') as any })));
  r.get('/settings', async (c) => c.json(await store.getSettings()));
  r.patch('/settings', async (c) => {
    const body = (await c.req.json()) as Partial<SeasonSettings>;
    const allowed: (keyof SeasonSettings)[] = ['season', 'dropoffDeadline', 'dropoffLocation', 'dropoffHours', 'contactEmail', 'contactPhone', 'catalogOpen', 'registrationOpen', 'perChildBudgetNote', 'orgDonateUrl', 'chipInsEnabled', 'chipInUrl', 'showPhotos', 'askFamilyPhoto', 'adminAlerts', 'alertEmails', 'contactName'];
    const patch: Partial<SeasonSettings> = {};
    for (const k of allowed) if (k in body) (patch as any)[k] = body[k];
    if (typeof patch.alertEmails === 'string') {
      const list = parseEmails(patch.alertEmails);
      const bad = patch.alertEmails.split(/[,;\s]+/).filter((e) => e && !/^\S+@\S+\.\S+$/.test(e));
      if (bad.length) throw new HttpError(400, `Not a valid email: ${bad.join(', ')}`);
      patch.alertEmails = list.join(', ');
    }
    return c.json(await store.updateSettings(patch));
  });
  // ---- community: quotes + Wall of Holiday Konnectors ----
  r.get('/quotes', async (c) => c.json(await store.listQuotes()));
  const QuoteBody = z.object({ quote: z.string().trim().min(3).max(600), name: z.string().trim().min(1).max(80), role: z.enum(QUOTE_ROLES), organization: z.string().trim().max(120).default(''), featured: z.boolean().default(false) });
  r.post('/quotes', async (c) => {
    const body = QuoteBody.parse(await c.req.json());
    const settings = await store.getSettings();
    const q = await store.createQuote({ ...body, email: '', status: 'Approved', season: settings.season, familyId: null, sponsorshipId: null, submittedAt: nowIso() });
    await store.logActivity({ type: 'admin_action', channel: 'system', familyId: null, sponsorshipId: null, subject: `${c.get('admin')} added a quote from ${q.name}`, body: '', meta: { quoteId: q.id }, occurredAt: nowIso() });
    return c.json(q);
  });
  const QuotePatch = QuoteBody.partial().extend({ status: z.enum(QUOTE_STATUSES).optional() });
  r.patch('/quotes/:id', async (c) => {
    const patch = QuotePatch.parse(await c.req.json());
    const q = await store.updateQuote(c.req.param('id'), patch);
    await store.logActivity({ type: 'admin_action', channel: 'system', familyId: q.familyId, sponsorshipId: q.sponsorshipId, subject: `${c.get('admin')} updated a quote from ${q.name}`, body: '', meta: { quoteId: q.id, patch }, occurredAt: nowIso() });
    return c.json(q);
  });
  r.get('/wall', async (c) => {
    const settings = await store.getSettings();
    const [sponsors, sps, fams] = await Promise.all([store.listSponsors(), store.listSponsorships(), store.listFamilies({ season: settings.season })]);
    const seasonFams = new Set(fams.map((f) => f.id));
    return c.json(
      sponsors
        .map((p) => {
          const mine = sps.filter((s) => s.sponsorId === p.id && seasonFams.has(s.familyId) && s.status !== 'Released');
          const done = mine.filter((s) => s.status === 'Dropped Off' || s.status === 'Delivered').length;
          return { id: p.id, name: p.name, email: p.email, organization: p.organization, displayName: p.displayName, publicName: wallName(p), wallOptIn: p.wallOptIn, wallHidden: p.wallHidden, active: mine.length, done, showing: p.wallOptIn && !p.wallHidden && done > 0 };
        })
        .filter((p) => p.active > 0 || p.wallOptIn)
        .sort((a, b) => Number(b.showing) - Number(a.showing) || b.done - a.done || a.publicName.localeCompare(b.publicName)),
    );
  });
  const SponsorPatch = z.object({ wallHidden: z.boolean().optional(), wallOptIn: z.boolean().optional(), displayName: z.string().trim().max(80).optional() });
  r.patch('/sponsors/:id', async (c) => {
    const patch = SponsorPatch.parse(await c.req.json());
    const p = await store.updateSponsor(c.req.param('id'), patch);
    await store.logActivity({ type: 'admin_action', channel: 'system', familyId: null, sponsorshipId: null, subject: `${c.get('admin')} updated Konnector ${p.name}`, body: '', meta: { patch }, occurredAt: nowIso() });
    return c.json(p);
  });

  r.post('/followups/run', async (c) => {
    const result = await followUp.tick();
    const m = adminAlert({ kind: 'admin_followup_run', ...result, by: c.get('admin') });
    await services.mailer.send({ to: c.get('admin'), subject: m.subject, spec: m.spec, kind: 'admin_followup_run', audience: 'admin', actor: c.get('admin') });
    return c.json(result);
  });

  // ---- email log ----
  r.get('/emails', async (c) => {
    const limit = Math.min(1000, Number(c.req.query('limit') ?? 400));
    const [rows, fams, sps] = await Promise.all([store.listActivity({ types: ['message_sent'], limit }), store.listFamilies(), store.listSponsorships()]);
    const fm = new Map(fams.map((f) => [f.id, f]));
    const sm = new Map(sps.map((s) => [s.id, s]));
    return c.json(rows.map((a) => {
      const m = a.meta as Record<string, any>;
      const f = a.familyId ? fm.get(a.familyId) : undefined;
      return {
        id: a.id, at: a.occurredAt, subject: a.subject, body: a.body, kind: m.kind ?? '', to: m.to ?? '', ok: m.ok !== false, error: m.error ?? '', provider: m.provider ?? '', actor: m.actor ?? 'system',
        channel: a.channel, audience: m.audience ?? (m.kind?.startsWith('family') ? 'family' : a.sponsorshipId ? 'konnector' : 'admin'),
        family: f ? { id: f.id, familyId: f.familyId, nickname: toPublicFamily(f).nickname } : null, sponsorshipId: a.sponsorshipId ? sm.get(a.sponsorshipId)?.sponsorshipId ?? null : null,
      };
    }));
  });
  r.post('/emails/test', async (c) => {
    const { to } = (await c.req.json().catch(() => ({}))) as { to?: string };
    const addr = String(to ?? c.get('admin')).trim();
    if (!/^\S+@\S+\.\S+$/.test(addr)) throw new HttpError(400, 'Enter a valid email.');
    const m = testEmail(c.get('admin'));
    const res = await services.mailer.send({ to: addr, subject: m.subject, spec: m.spec, kind: 'test', audience: 'test', actor: c.get('admin') });
    return c.json({ ok: res.ok, error: res.error, id: res.id, provider: config.notify.driver });
  });

  // ---- sponsors export ----
  r.get('/sponsors.csv', async (c) => {
    const settings = await store.getSettings();
    const [sponsors, sps, fams] = await Promise.all([store.listSponsors(), store.listSponsorships(), store.listFamilies({ season: settings.season })]);
    const fm = new Map(fams.map((f) => [f.id, f]));
    const rows = [['Sponsor', 'Email', 'Phone', 'Organization', 'Public name', 'On the wall', 'Sponsorship ID', 'Family ID', 'Family', 'Kids', 'Status', 'Hand-off', 'Claimed', 'Shopping', 'Purchased', 'Wrapped', 'Handed off', 'Delivered', 'Released', 'Release reason', 'Follow-ups unanswered', 'Flagged', 'Sponsor note', 'Admin notes']];
    for (const p of sponsors) {
      const mine = sps.filter((s) => s.sponsorId === p.id && fm.has(s.familyId)).sort((a, b) => a.claimedAt.localeCompare(b.claimedAt));
      const base = [p.name, p.email, p.phone, p.organization, wallName(p), p.wallOptIn && !p.wallHidden ? 'Yes' : 'No'];
      if (!mine.length) { rows.push([...base, ...Array(18).fill('')]); continue; }
      for (const s of mine) {
        const f = fm.get(s.familyId)!;
        const d = (x: string | null) => (x ? x.slice(0, 10) : '');
        rows.push([...base, s.sponsorshipId, f.familyId, toPublicFamily(f).nickname, String(f.children.length), s.status, s.handoff, d(s.claimedAt), d(s.shoppingAt), d(s.purchasedAt), d(s.wrappedAt), d(s.droppedOffAt), d(s.deliveredAt), d(s.releasedAt), s.releaseReason, String(s.followUpCount), s.flagged ? 'Yes' : 'No', s.sponsorNote, s.adminNotes]);
      }
    }
    const csv = toCsv(rows);
    return c.body(csv, 200, { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="bless-this-family-sponsors-${settings.season}.csv"` });
  });
  r.get('/export.csv', async (c) => {
    const settings = await store.getSettings();
    const fams = await store.listFamilies({ season: settings.season });
    const sps = await store.listSponsorships();
    const sponsors = new Map((await store.listSponsors()).map((s) => [s.id, s]));
    const rows = [['Family ID', 'Nickname', 'Status', 'Guardian', 'Phone', 'Email', 'Address', 'City', 'State', 'ZIP', 'Transportation', 'Child', 'Age', 'Gender', 'Clothing Category', 'Shirt', 'Pants', 'Shoe Category', 'Shoe', 'Size Notes', 'Favorite Color', 'Hobbies', 'Clothing Wishlist', 'Other Clothing', 'Gift Types', 'Specific Gifts', 'Holiday Konnector', 'Konnector Email', 'Konnector Phone', 'Hand-off', 'Sponsorship Status']];
    for (const f of fams) {
      const s = sps.filter((x) => x.familyId === f.id && x.status !== 'Released').sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))[0];
      const sp = s ? sponsors.get(s.sponsorId) : null;
      for (const k of f.children) rows.push([f.familyId, toPublicFamily(f).nickname, f.status, f.guardianName, f.phone, f.email, f.address, f.city, f.state, f.zip, f.transportation, k.name, String(k.age), k.gender, k.clothingCategory, k.shirtSize, k.pantsSize, k.shoeCategory, k.shoeSize, k.sizeNotes, k.favoriteColor, k.hobbies, k.clothingWishlist.join('; '), k.otherClothing, k.giftTypes.join('; '), k.specificGifts, sp?.name ?? '', sp?.email ?? '', sp?.phone ?? '', s?.handoff ?? '', s?.status ?? '']);
    }
    const csv = toCsv(rows);
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
