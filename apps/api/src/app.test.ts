import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.ADMIN_EMAILS = 'admin@example.com';
process.env.SESSION_SECRET = 'test-secret';
const { createApp } = await import('./app.ts');
const { MemoryStore } = await import('./store/memory.ts');
const { seedDemo } = await import('./lib/seed.ts');

const store = new MemoryStore(null);
await seedDemo(store);
const { app, services } = createApp(store);
const json = async (res: Response) => ({ status: res.status, body: await res.json() });
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });

test('catalog only exposes available families and no private data', async () => {
  const { status, body } = await json(await app.request('/api/families'));
  assert.equal(status, 200);
  assert.ok(body.families.length >= 4);
  assert.ok(body.families.every((f: any) => f.status === 'Available'));
  const raw = JSON.stringify(body);
  assert.ok(!raw.includes('Demo Guardian') && !raw.includes('48201') && !raw.includes('555-0100'));
});

test('register → admin approve → claim → sponsor dominoes → report', async () => {
  const reg = await json(await post('/api/register', {
    eligibilityConfirmed: true, guardianName: 'Test Parent', phone: '313-555-9999', email: 'parent@example.com', address: '9 Test St', city: 'Detroit', state: 'MI', zip: '48202',
    transportation: 'No', familyStory: 'A story', children: [{ name: 'Kai Tester', age: 9, gender: 'Male', clothingCategory: 'Youth / Kids', shirtSize: '10', pantsSize: '10', shoeCategory: 'Youth / Kids', shoeSize: '3', favoriteColor: 'Blue', giftTypes: ['Books'], clothingWishlist: ['Winter Coat'] }],
  }));
  assert.equal(reg.status, 200, JSON.stringify(reg.body));
  const fam = await store.getFamilyByCode(reg.body.familyId);
  assert.ok(fam && fam.status === 'Submitted');

  // not visible publicly yet
  assert.equal((await app.request(`/api/families/${fam!.slug}`)).status, 404);

  // admin login via dev link
  const req = await json(await post('/api/admin/auth/request', { email: 'admin@example.com' }));
  assert.ok(req.body.devLink);
  const token = new URL(req.body.devLink).searchParams.get('token')!;
  const verify = await post('/api/admin/auth/verify', { token });
  assert.equal(verify.status, 200);
  const cookie = verify.headers.get('set-cookie')!.split(';')[0];
  const admin = { cookie };

  assert.equal((await app.request('/api/admin/report')).status, 401);
  const approve = await json(await app.request(`/api/admin/families/${fam!.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Available', storyApproved: true }), headers: { 'content-type': 'application/json', ...admin } }));
  assert.equal(approve.status, 200);
  assert.equal(approve.body.status, 'Available');
  assert.ok(approve.body.approvedAt);

  const pub = await json(await app.request(`/api/families/${fam!.slug}`));
  assert.equal(pub.status, 200);
  assert.equal(pub.body.story, 'A story');
  assert.equal(pub.body.children[0].name, 'Kai');

  // claim
  const bad = await json(await post(`/api/families/${fam!.slug}/claim`, { name: 'S', email: 'nope' }));
  assert.equal(bad.status, 400);
  const claim = await json(await post(`/api/families/${fam!.slug}/claim`, { name: 'Sam Sponsor', email: 'sam@example.com', agree: true }));
  assert.equal(claim.status, 200, JSON.stringify(claim.body));
  assert.ok(claim.body.token);
  const again = await json(await post(`/api/families/${fam!.slug}/claim`, { name: 'Other', email: 'o@example.com', agree: true }));
  assert.equal(again.status, 409);

  // sponsor portal + dominoes
  const portal = await json(await app.request(`/api/sponsor/${claim.body.token}`));
  assert.equal(portal.status, 200);
  assert.equal(portal.body.sponsorship.status, 'Claimed');
  assert.ok(!JSON.stringify(portal.body).includes('Test Parent'));
  const conf = await json(await post(`/api/sponsor/${claim.body.token}/status`, { status: 'Confirmed' }));
  assert.equal(conf.body.sponsorship.status, 'Confirmed');
  const deliveredBySponsor = await post(`/api/sponsor/${claim.body.token}/status`, { status: 'Delivered' });
  assert.equal(deliveredBySponsor.status, 403);
  const shop = await json(await post(`/api/sponsor/${claim.body.token}/status`, { status: 'Shopping', note: 'Got the coat!' }));
  assert.equal(shop.body.sponsorship.status, 'Shopping');
  const drop = await json(await post(`/api/sponsor/${claim.body.token}/status`, { status: 'Dropped Off' }));
  assert.equal(drop.body.sponsorship.status, 'Dropped Off');

  // staff delivers
  const sp = (await store.listSponsorships({ familyId: fam!.id }))[0];
  const del = await json(await app.request(`/api/admin/sponsorships/${sp.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Delivered' }), headers: { 'content-type': 'application/json', ...admin } }));
  assert.equal(del.body.status, 'Delivered');
  assert.equal((await store.getFamily(fam!.id))!.status, 'Fulfilled');

  const report = await json(await app.request('/api/admin/report', { headers: admin }));
  assert.equal(report.status, 200);
  assert.ok(report.body.pipeline.Fulfilled >= 2);
  assert.ok(report.body.followUp.overdue.length >= 1, 'seeded unresponsive sponsor is overdue');
  assert.ok(report.body.matching.claimsByDay.length === 30);

  // scheduler tick nudges the seeded Claimed sponsor and eventually flags
  const tick = await json(await post('/api/admin/followups/run', {}, admin));
  assert.equal(tick.status, 200);
  assert.ok(tick.body.flagged + tick.body.sent >= 1, JSON.stringify(tick.body));

  const csv = await app.request('/api/admin/export.csv', { headers: admin });
  assert.equal(csv.status, 200);
  assert.ok((await csv.text()).includes('Kai Tester'));

  // assistant unavailable without key
  const a = await json(await post('/api/admin/assistant', { message: 'hi' }, admin));
  assert.equal(a.status, 503);
  assert.ok(services);
});
