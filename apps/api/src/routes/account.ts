import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { TeamInvitesSchema, teamMembers, teamOf, toPublicFamily } from '@bless/shared';
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

  // A sign-in link, or a team invite link (signs in and joins the team in one tap).
  r.post('/verify', async (c) => {
    const { token } = (await c.req.json().catch(() => ({}))) as { token?: string };
    const invite = verifyToken(token, 'k_invite');
    const claims = invite ?? verifyToken(token, 'k_login');
    if (!claims) throw new HttpError(401, 'That link is invalid or has expired. Request a new one.');
    let team: { joined: boolean; message?: string } | undefined;
    if (invite) {
      const sponsor = await store.findSponsorByEmail(invite.email);
      if (!sponsor) throw new HttpError(401, 'That link is invalid or has expired. Request a new one.');
      try { await services.teams.accept(sponsor, invite.team); team = { joined: true }; }
      catch (e) { team = { joined: false, message: e instanceof Error ? e.message : 'Could not join the team' }; }
    }
    setKonnectorSession(c, claims.email);
    return c.json({ ok: true, ...(team ? { team } : {}) });
  });

  async function signedIn(c: Context) {
    const claims = verifyToken(getCookie(c, KONNECTOR_COOKIE), 'k_session');
    const sponsor = claims ? await store.findSponsorByEmail(claims.email) : null;
    if (!sponsor) throw new HttpError(401, 'Not signed in');
    return sponsor;
  }

  /** The Konnector's dashboard: their team, a pending invite, and every family anyone on the team is blessing. */
  async function me(c: Context) {
    const sponsor = await signedIn(c);
    const [everyone, sps, families] = await Promise.all([store.listSponsors(), store.listSponsorships(), store.listFamilies()]);
    const fams = new Map(families.map((f) => [f.id, f]));
    const people = new Map(everyone.map((p) => [p.id, p]));
    const ids = new Set(teamOf(sponsor, everyone).joined.map((p) => p.id));
    const inviter = sponsor.teamInvite ? everyone.find((p) => p.email.toLowerCase() === sponsor.invitedBy.toLowerCase()) : undefined;
    const inviteTeam = sponsor.teamInvite ? everyone.filter((p) => p.teamId === sponsor.teamInvite) : [];
    return {
      sponsor: { id: sponsor.id, name: sponsor.name, email: sponsor.email, phone: sponsor.phone, organization: sponsor.organization, displayName: sponsor.displayName, wallOptIn: sponsor.wallOptIn },
      team: teamMembers(sponsor, everyone),
      invite: sponsor.teamInvite && inviteTeam.length ? { from: inviter?.name ?? inviteTeam[0]!.name, members: inviteTeam.map((p) => p.name), invitedAt: sponsor.invitedAt } : null,
      families: sps
        .filter((s) => ids.has(s.sponsorId))
        .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))
        .map((s) => {
          const f = fams.get(s.familyId); const p = f ? toPublicFamily(f) : null;
          return { token: s.token, sponsorshipId: s.sponsorshipId, status: s.status, handoff: s.handoff, claimedAt: s.claimedAt, nickname: p?.nickname ?? 'A family', kidLine: p?.kidLine ?? '', kidNames: p?.kidNames ?? '', colors: p?.colors ?? [], claimedBy: s.sponsorId === sponsor.id ? '' : people.get(s.sponsorId)?.name ?? '' };
        }),
    };
  }
  r.get('/me', async (c) => c.json(await me(c)));

  // ---- co-sponsor team ----
  r.post('/team', async (c) => {
    const parsed = TeamInvitesSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Check the names and emails', issues: parsed.error.flatten() }, 400);
    const res = await services.teams.invite(await signedIn(c), parsed.data.invites);
    return c.json({ ...res, me: await me(c) });
  });
  r.post('/team/accept', async (c) => { await services.teams.accept(await signedIn(c)); return c.json(await me(c)); });
  r.post('/team/decline', async (c) => { await services.teams.decline(await signedIn(c)); return c.json(await me(c)); });
  r.delete('/team/:memberId', async (c) => { await services.teams.remove(await signedIn(c), c.req.param('memberId')); return c.json(await me(c)); });

  r.post('/logout', (c) => {
    deleteCookie(c, KONNECTOR_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  return r;
}
