import { Hono } from 'hono';
import { SponsorUpdateSchema, canTransition } from '@bless/shared';
import type { Services } from '../lib/services.ts';
import { HttpError } from '../lib/services.ts';
import { nowIso } from '../lib/ids.ts';

export function sponsorRoutes(services: Services) {
  const r = new Hono();

  r.get('/:token', async (c) => c.json(await services.sponsorPortal(c.req.param('token'))));

  r.post('/:token/status', async (c) => {
    const s = await services.store.getSponsorshipByToken(c.req.param('token'));
    if (!s) throw new HttpError(404, 'This link is not valid.');
    const parsed = SponsorUpdateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'Invalid update' }, 400);
    const { status, note, reason } = parsed.data;
    if (status === 'Delivered') throw new HttpError(403, 'Only The Konnection staff can mark a family as delivered.');
    if (!canTransition(s.status, status)) throw new HttpError(409, `Can't move from ${s.status} to ${status}.`);
    await services.followUp.transition(s, status, { actor: 'sponsor', note, reason });
    return c.json(await services.sponsorPortal(s.token));
  });

  r.post('/:token/note', async (c) => {
    const s = await services.store.getSponsorshipByToken(c.req.param('token'));
    if (!s) throw new HttpError(404, 'This link is not valid.');
    const { note } = (await c.req.json()) as { note?: string };
    const text = String(note ?? '').trim().slice(0, 1000);
    if (!text) return c.json({ error: 'Empty note' }, 400);
    await services.store.updateSponsorship(s.id, { sponsorNote: text, lastResponseAt: nowIso(), followUpCount: 0, flagged: false, flagReason: '' });
    await services.store.logActivity({ type: 'sponsor_response', channel: 'web', familyId: s.familyId, sponsorshipId: s.id, subject: 'Sponsor left a note', body: text, meta: {}, occurredAt: nowIso() });
    return c.json(await services.sponsorPortal(s.token));
  });

  return r;
}
