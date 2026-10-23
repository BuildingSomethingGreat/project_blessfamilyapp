import { Hono } from 'hono';
import { ClaimRequestSchema, FamilyApplicationSchema } from '@bless/shared';
import type { Services } from '../lib/services.ts';
import { HttpError } from '../lib/services.ts';
import { nowIso } from '../lib/ids.ts';

const recentViews = new Map<string, number>();
function dedupe(key: string, ms: number) {
  const now = Date.now();
  if (recentViews.size > 5000) for (const [k, t] of recentViews) if (now - t > ms) recentViews.delete(k);
  const last = recentViews.get(key);
  if (last && now - last < ms) return false;
  recentViews.set(key, now);
  return true;
}

/** Small fixed-window limiter: `max` hits per `windowMs` per key. */
const buckets = new Map<string, { n: number; reset: number }>();
function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  b.n++;
  return b.n <= max;
}

export function publicRoutes(services: Services) {
  const r = new Hono();
  const ip = (c: any) => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('fly-client-ip') || 'local';

  r.get('/settings', async (c) => {
    const s = await services.store.getSettings();
    const { contactPhone, ...pub } = s;
    return c.json({ ...pub, contactPhone });
  });

  r.get('/families', async (c) => {
    if (dedupe(`catalog:${ip(c)}`, 10 * 60_000)) {
      services.store.logActivity({ type: 'catalog_view', channel: 'web', familyId: null, sponsorshipId: null, subject: '', body: '', meta: {}, occurredAt: nowIso() }).catch(() => {});
    }
    return c.json(await services.publicCatalog());
  });

  r.get('/families/:slug', async (c) => {
    const slug = c.req.param('slug');
    const fam = await services.publicFamily(slug);
    if (dedupe(`view:${ip(c)}:${slug}`, 60 * 60_000)) services.recordView(slug).catch(() => {});
    return c.json(fam);
  });

  r.post('/families/:slug/claim-start', async (c) => {
    const slug = c.req.param('slug');
    if (dedupe(`cs:${ip(c)}:${slug}`, 60 * 60_000)) await services.recordClaimStart(slug);
    return c.json({ ok: true });
  });

  r.post('/families/:slug/claim', async (c) => {
    if (!allow(`claim:${ip(c)}`, 8, 60_000)) throw new HttpError(429, 'Slow down a moment and try again.');
    const parsed = ClaimRequestSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'Please check the form', issues: parsed.error.flatten() }, 400);
    return c.json(await services.claim(c.req.param('slug'), parsed.data));
  });

  r.post('/register', async (c) => {
    if (!allow(`reg:${ip(c)}`, 5, 10 * 60_000)) throw new HttpError(429, 'Slow down a moment and try again.');
    const parsed = FamilyApplicationSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'Please check the form', issues: parsed.error.flatten() }, 400);
    const fam = await services.registerFamily(parsed.data);
    return c.json({ familyId: fam.familyId });
  });

  return r;
}
