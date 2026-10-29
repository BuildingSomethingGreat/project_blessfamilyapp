import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { toPublicFamily } from '@bless/shared';
import { config } from '../config.ts';
import { isAdminEmail, konnectorLoginToken, konnectorSessionToken, KONNECTOR_COOKIE, KONNECTOR_COOKIE_MAX_AGE, loginToken, verifyToken } from '../lib/auth.ts';
import type { Services } from '../lib/services.ts';
import { HttpError } from '../lib/services.ts';
import { adminLoginEmail, konnectorLoginEmail, konnectorNoAccountEmail } from '../followup/messages.ts';

const hits = new Map<string, { n: number; reset: number }>();
function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = hits.get(key);
  if (!b || b.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return true; }
  return ++b.n <= max;
}

/** Signs a Holiday Konnector in on this device (used after a magic link, and right after claiming). */
export function setKonnectorSession(c: Context, email: string) {
  setCookie(c, KONNECTOR_COOKIE, konnectorSessionToken(email), { httpOnly: true, sameSite: 'Lax', secure: config.isProd, path: '/', maxAge: KONNECTOR_COOKIE_MAX_AGE });
}

/**
 * One "Log in" for everyone. Holiday Konnectors get a link to their account; admins get the admin
 * sign-in link. The response never says which, so the form can't be used to look up emails.
 */
export function accountRoutes(services: Services) {
  const r = new Hono();
  const { store, mailer } = services;
  const ip = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';

  r.post('/login', async (c) => {
    const { email } = (await c.req.json().catch(() => ({}))) as { email?: string };
    const e = String(email ?? '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) throw new HttpError(400, 'Enter a valid email.');
    if (!allow(`login:${ip(c)}`, 6, 10 * 60_000) || !allow(`login:${e}`, 3, 10 * 60_000)) throw new HttpError(429, 'Too many tries. Wait a few minutes and try again.');
    const sponsor = await store.findSponsorByEmail(e);
    const admin = isAdminEmail(e);
    let devLink: string | undefined;
    if (sponsor) {
      const link = `${config.webUrl}/login?token=${encodeURIComponent(konnectorLoginToken(e))}`;
      const m = konnectorLoginEmail(link);
      await mailer.send({ to: e, subject: m.subject, spec: m.spec, kind: 'konnector_login', audience: 'konnector', logBody: 'Sign-in link (hidden from the log).' });
      devLink = link;
    }
    if (admin) {
      const link = `${config.webUrl}/admin/login?token=${encodeURIComponent(loginToken(e))}`;
      const m = adminLoginEmail(link);
      await mailer.send({ to: e, subject: m.subject, spec: m.spec, kind: 'admin_login', audience: 'admin', logBody: 'Admin sign-in link (hidden from the log).' });
      devLink ??= link;
    }
    if (!sponsor && !admin) {
      const m = konnectorNoAccountEmail(e);
      await mailer.send({ to: e, subject: m.subject, spec: m.spec, kind: 'konnector_no_account', audience: 'konnector' });
    }
    const dev = !config.isProd && config.notify.driver === 'console';
    return c.json({ ok: true, ...(dev ? { devLink } : {}) });
  });

  r.post('/verify', async (c) => {
    const { token } = (await c.req.json().catch(() => ({}))) as { token?: string };
    const claims = verifyToken(token, 'k_login');
    if (!claims) throw new HttpError(401, 'That link is invalid or has expired. Request a new one.');
    setKonnectorSession(c, claims.email);
    return c.json({ ok: true });
  });

  r.get('/me', async (c) => {
    const claims = verifyToken(getCookie(c, KONNECTOR_COOKIE), 'k_session');
    if (!claims) throw new HttpError(401, 'Not signed in');
    const sponsor = await store.findSponsorByEmail(claims.email);
    if (!sponsor) throw new HttpError(401, 'Not signed in');
    const [sps, families] = await Promise.all([store.listSponsorships({ sponsorId: sponsor.id }), store.listFamilies()]);
    const fams = new Map(families.map((f) => [f.id, f]));
    return c.json({
      sponsor: { name: sponsor.name, email: sponsor.email, displayName: sponsor.displayName, wallOptIn: sponsor.wallOptIn },
      families: sps
        .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))
        .map((s) => { const f = fams.get(s.familyId); const p = f ? toPublicFamily(f) : null; return { token: s.token, sponsorshipId: s.sponsorshipId, status: s.status, handoff: s.handoff, claimedAt: s.claimedAt, nickname: p?.nickname ?? 'A family', kidLine: p?.kidLine ?? '', kidNames: p?.kidNames ?? '', colors: p?.colors ?? [] }; }),
    });
  });

  r.post('/logout', (c) => {
    deleteCookie(c, KONNECTOR_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  return r;
}
