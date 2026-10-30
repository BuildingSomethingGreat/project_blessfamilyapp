import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { toPublicFamily } from '@bless/shared';
import { config } from '../config.ts';
import { konnectorLoginToken, konnectorSessionToken, KONNECTOR_COOKIE, KONNECTOR_COOKIE_MAX_AGE, verifyToken } from '../lib/auth.ts';
import type { Services } from '../lib/services.ts';
import { HttpError } from '../lib/services.ts';
import { konnectorLoginEmail, konnectorNoAccountEmail } from '../followup/messages.ts';

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
 * "Sponsor log in". Holiday Konnectors get a link to their account; anyone else gets a "you're not a
 * sponsor yet" email. The response is the same either way, so the form can't be used to look up emails.
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
    // Sponsors only. Staff emails are treated like any other address here; the admin sign-in link is shared privately.
    const sponsor = await store.findSponsorByEmail(e);
    let devLink: string | undefined;
    if (sponsor) {
      const link = `${config.webUrl}/login?token=${encodeURIComponent(konnectorLoginToken(e))}`;
      const m = konnectorLoginEmail(link);
      await mailer.send({ to: e, subject: m.subject, spec: m.spec, kind: 'konnector_login', audience: 'konnector', logBody: 'Sign-in link (hidden from the log).' });
      devLink = link;
    } else {
      const m = konnectorNoAccountEmail(e);
      await mailer.send({ to: e, subject: m.subject, spec: m.spec, kind: 'konnector_no_account', audience: 'konnector', reason: 'You are getting this because someone asked to log in to Bless-a-Family with this email.' });
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
      sponsor: { name: sponsor.name, email: sponsor.email, phone: sponsor.phone, organization: sponsor.organization, displayName: sponsor.displayName, wallOptIn: sponsor.wallOptIn },
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
