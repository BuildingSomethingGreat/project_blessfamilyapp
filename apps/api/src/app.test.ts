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
    transportation: 'No', familyStory: 'A story', children: [{ name: 'Kai Tester', age: 9, gender: 'Boy', clothingCategory: 'Youth / Kids', shirtSize: '10', pantsSize: '10', shoeCategory: 'Youth / Kids', shoeSize: '3', favoriteColor: 'Blue', giftTypes: ['Books'], clothingWishlist: ['Winter Coat'] }],
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
  const conf = await json(await post(`/api/sponsor/${claim.body.token}/status`, { status: 'Shopping' }));
  assert.equal(conf.body.sponsorship.status, 'Shopping');
  const deliveredBySponsor = await post(`/api/sponsor/${claim.body.token}/status`, { status: 'Delivered' });
  assert.equal(deliveredBySponsor.status, 403);
  const shop = await json(await post(`/api/sponsor/${claim.body.token}/status`, { status: 'Purchased', note: 'Got the coat!' }));
  assert.equal(shop.body.sponsorship.status, 'Purchased');
  const wrap = await json(await post(`/api/sponsor/${claim.body.token}/status`, { status: 'Wrapped' }));
  assert.equal(wrap.body.sponsorship.status, 'Wrapped');
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

  // chip-in records a pledge and returns the external checkout
  const avail = (await json(await app.request('/api/families'))).body.families[0];
  const chip = await json(await post(`/api/families/${avail.slug}/chip-in`, { amount: 50, coverFees: true, email: 'c@example.com' }));
  assert.equal(chip.status, 200, JSON.stringify(chip.body));
  assert.equal(chip.body.total, 51.2);
  assert.ok(chip.body.checkoutUrl.includes('zeffy'));
  assert.equal(chip.body.family.raised, avail.raised + 50);

  // assistant unavailable without key
  const a = await json(await post('/api/admin/assistant', { message: 'hi' }, admin));
  assert.equal(a.status, 503);
  assert.ok(services);
});

test('a duplicate claim written by another instance loses to the earlier one', async () => {
  const fam = (await store.listFamilies({ status: ['Available'] }))[0];
  // Simulate a second serverless instance that already wrote a claim a moment earlier but hasn't flipped the family yet.
  const rival = await store.createSponsor({ name: 'Early Bird', email: 'early@example.com', phone: '', organization: '', preferredContact: 'Email', notes: '', displayName: '', wallOptIn: false, wallHidden: false });
  await store.createSponsorship({ sponsorshipId: 'SP-T-1', familyId: fam.id, sponsorId: rival.id, status: 'Claimed', token: 'rival-token', handoff: 'Drop off', claimedAt: new Date(Date.now() - 1000).toISOString(), shoppingAt: null, purchasedAt: null, wrappedAt: null, droppedOffAt: null, deliveredAt: null, releasedAt: null, nextFollowUpAt: null, lastNudgedAt: null, lastResponseAt: null, followUpCount: 0, flagged: false, flagReason: '', releaseReason: '', sponsorNote: '', adminNotes: '' });
  const res = await post(`/api/families/${fam.slug}/claim`, { name: 'Late Comer', email: 'late@example.com', agree: true });
  assert.equal(res.status, 409);
  const mine = (await store.listSponsorships({ familyId: fam.id })).filter((s) => s.sponsorId !== rival.id);
  assert.ok(mine.every((s) => s.status === 'Released'), 'the later duplicate is released');
});

test('claim records hand-off choice and wall opt-in; the wall only shows names after hand-off', async () => {
  const taken = new Set((await store.listSponsorships({ status: ['Claimed'] })).map((s) => s.familyId));
  const fresh = (await store.listFamilies({ status: ['Available'] })).find((f) => !taken.has(f.id))!;
  const res = await (await post(`/api/families/${fresh.slug}/claim`, { name: 'Wanda Wall', email: 'wanda@example.com', agree: true, handoff: 'Deliver directly', wallOptIn: true, displayName: 'The Wall Family' })).json();
  assert.ok(res.token, JSON.stringify(res));
  const sp = (await store.getSponsorshipByToken(res.token))!;
  assert.equal(sp.handoff, 'Deliver directly');
  const before = await (await app.request('/api/community')).json();
  assert.ok(!before.wall.some((w: any) => w.name === 'The Wall Family'), 'not on the wall before gifts are handed off');
  for (const status of ['Shopping', 'Purchased', 'Wrapped', 'Dropped Off']) assert.equal((await post(`/api/sponsor/${res.token}/status`, { status })).status, 200);
  const after = await (await app.request('/api/community')).json();
  assert.ok(after.wall.some((w: any) => w.name === 'The Wall Family'));
  assert.ok(!JSON.stringify(after).includes('wanda@example.com'), 'no emails in the public feed');
});

test('quotes are pending until approved', async () => {
  const sent = await post('/api/quotes', { role: 'Konnection family', name: 'A Konnection dad', quote: 'Thank you for making our holiday so special.', consent: true });
  assert.equal(sent.status, 200);
  const pub = await (await app.request('/api/community')).json();
  assert.ok(!pub.quotes.some((q: any) => q.name === 'A Konnection dad'));
  const q = (await store.listQuotes()).find((x) => x.name === 'A Konnection dad')!;
  assert.equal(q.status, 'Pending');
  await store.updateQuote(q.id, { status: 'Approved' });
  const pub2 = await (await app.request('/api/community')).json();
  assert.ok(pub2.quotes.some((x: any) => x.name === 'A Konnection dad'));
  assert.equal((await post('/api/quotes', { role: 'Konnection family', name: 'X', quote: 'too short', consent: false })).status, 400);
});
