import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { SponsorUpdateSchema, TeamInvitesSchema, canTransition, teamOf, toPublicFamily } from '@bless/shared';
import { KONNECTOR_COOKIE, verifyToken } from '../lib/auth.ts';
import type { Services } from '../lib/services.ts';
import { HttpError } from '../lib/services.ts';
import { nowIso } from '../lib/ids.ts';

export function sponsorRoutes(services: Services) {
  const r = new Hono();
  /** The signed-in Konnector on this device, if any. */
  const viewer = (c: Context) => verifyToken(getCookie(c, KONNECTOR_COOKIE), 'k_session')?.email ?? null;
  const view = (c: Context, token: string) => services.sponsorPortal(token, viewer(c));

  /**
   * Who is acting on a family page: the signed-in teammate when there is one, otherwise the Konnector
   * who chose the family (the link is theirs). Everyone on a team has the same permissions.
   */
  async function actorFor(c: Context, token: string) {
    const s = await services.store.getSponsorshipByToken(token);
    if (!s) throw new HttpError(404, 'This link is not valid.');
    const everyone = await services.store.listSponsors();
    const owner = everyone.find((p) => p.id === s.sponsorId);
    if (!owner) throw new HttpError(404, 'This link is not valid.');
    const email = viewer(c)?.toLowerCase();
    const me = email ? teamOf(owner, everyone).joined.find((p) => p.email.toLowerCase() === email) : undefined;
    return { s, actor: me ?? owner };
  }

  r.get('/:token', async (c) => c.json(await view(c, c.req.param('token'))));

  // ---- co-sponsor team ----
  r.post('/:token/team', async (c) => {
    const parsed = TeamInvitesSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Check the names and emails', issues: parsed.error.flatten() }, 400);
    const { actor } = await actorFor(c, c.req.param('token'));
    const res = await services.teams.invite(actor, parsed.data.invites);
    return c.json({ ...res, view: await view(c, c.req.param('token')) });
  });
  r.delete('/:token/team/:memberId', async (c) => {
    const { actor } = await actorFor(c, c.req.param('token'));
    await services.teams.remove(actor, c.req.param('memberId'));
    return c.json(await view(c, c.req.param('token')));
  });

  r.post('/:token/status', async (c) => {
    const s = await services.store.getSponsorshipByToken(c.req.param('token'));
    if (!s) throw new HttpError(404, 'This link is not valid.');
    const parsed = SponsorUpdateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'Invalid update' }, 400);
    const { status, note, reason } = parsed.data;
    if (status === 'Delivered') throw new HttpError(403, 'Only The Konnection staff can mark a family as delivered.');
    if (!canTransition(s.status, status)) throw new HttpError(409, `Can't move from ${s.status} to ${status}.`);
    await services.followUp.transition(s, status, { actor: 'sponsor', note, reason });
    return c.json(await view(c, s.token));
  });

  r.post('/:token/wall', async (c) => {
    const { optIn, displayName } = (await c.req.json()) as { optIn?: boolean; displayName?: string };
    await services.setWall(c.req.param('token'), !!optIn, String(displayName ?? ''));
    return c.json(await view(c, c.req.param('token')));
  });

  r.post('/:token/note', async (c) => {
    const s = await services.store.getSponsorshipByToken(c.req.param('token'));
    if (!s) throw new HttpError(404, 'This link is not valid.');
    const { note } = (await c.req.json()) as { note?: string };
    const text = String(note ?? '').trim().slice(0, 1000);
    if (!text) return c.json({ error: 'Empty note' }, 400);
    await services.store.updateSponsorship(s.id, { sponsorNote: text, lastResponseAt: nowIso(), followUpCount: 0, flagged: false, flagReason: '' });
    await services.store.logActivity({ type: 'sponsor_response', channel: 'web', familyId: s.familyId, sponsorshipId: s.id, subject: 'Konnector left a note', body: text, meta: {}, occurredAt: nowIso() });
    const [family, sponsor] = await Promise.all([services.store.getFamily(s.familyId), services.store.getSponsor(s.sponsorId)]);
    if (family) await services.followUp.alert({ kind: 'admin_konnector_note', family, pub: toPublicFamily(family), sponsor, sponsorship: s, note: text }, { familyId: s.familyId, sponsorshipId: s.id }, { force: true });
    return c.json(await view(c, s.token));
  });

  return r;
}
