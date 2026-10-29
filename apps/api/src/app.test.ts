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
  const claim = await json(await post(`/api/families/${fam!.slug}/claim`, { name: 'Sam Sponsor', email: 'sam@example.com', agree: true, emailConsent: true }));
  assert.equal(claim.status, 200, JSON.stringify(claim.body));
  assert.ok(claim.body.token);
  const again = await json(await post(`/api/families/${fam!.slug}/claim`, { name: 'Other', email: 'o@example.com', agree: true, emailConsent: true }));
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
  const res = await post(`/api/families/${fam.slug}/claim`, { name: 'Late Comer', email: 'late@example.com', agree: true, emailConsent: true });
  assert.equal(res.status, 409);
  const mine = (await store.listSponsorships({ familyId: fam.id })).filter((s) => s.sponsorId !== rival.id);
  assert.ok(mine.every((s) => s.status === 'Released'), 'the later duplicate is released');
});

test('claim records hand-off choice and wall opt-in; the wall only shows names after hand-off', async () => {
  const taken = new Set((await store.listSponsorships({ status: ['Claimed'] })).map((s) => s.familyId));
  const fresh = (await store.listFamilies({ status: ['Available'] })).find((f) => !taken.has(f.id))!;
  const res = await (await post(`/api/families/${fresh.slug}/claim`, { name: 'Wanda Wall', email: 'wanda@example.com', agree: true, emailConsent: true, handoff: 'Deliver directly', wallOptIn: true, displayName: 'The Wall Family' })).json();
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

test('claims require email consent; every email is logged and visible to admins', async () => {
  const taken = new Set((await store.listSponsorships({ status: ['Claimed'] })).map((s) => s.familyId));
  const fresh = (await store.listFamilies({ status: ['Available'] })).find((f) => !taken.has(f.id))!;
  const noConsent = await post(`/api/families/${fresh.slug}/claim`, { name: 'Ellie Email', email: 'ellie@example.com', agree: true });
  assert.equal(noConsent.status, 400);
  const ok = await post(`/api/families/${fresh.slug}/claim`, { name: 'Ellie Email', email: 'ellie@example.com', phone: '313-555-0101', agree: true, emailConsent: true });
  assert.equal(ok.status, 200);
  assert.ok(ok.headers.get('set-cookie')?.includes('bf_konnector='), 'claiming signs the Konnector in');
  const portal = await (await app.request(`/api/sponsor/${(await ok.json()).token}`)).json();
  const emails = portal.timeline.filter((t: any) => t.type === 'message_sent');
  assert.ok(emails.length >= 1, 'their claim confirmation is in the thread');
  assert.ok(!JSON.stringify(portal.timeline).includes('admin team') && !JSON.stringify(portal.timeline).includes('Someone chose your family'), 'no team alerts or family emails in the Konnector thread');
  const sponsor = (await store.findSponsorByEmail('ellie@example.com'))!;
  assert.equal(sponsor.preferredContact, 'Email');
  assert.equal(sponsor.phone, '313-555-0101', 'phone is still recorded');

  const req = await json(await post('/api/admin/auth/request', { email: 'admin@example.com' }));
  const verify = await post('/api/admin/auth/verify', { token: new URL(req.body.devLink).searchParams.get('token')! });
  const admin = { cookie: verify.headers.get('set-cookie')!.split(';')[0] };

  const log = await json(await app.request('/api/admin/emails', { headers: admin }));
  assert.equal(log.status, 200);
  const mine = log.body.filter((e: any) => e.to === 'ellie@example.com');
  assert.ok(mine.some((e: any) => e.kind === 'claim_confirmation' && e.audience === 'konnector' && e.ok));
  assert.ok(log.body.some((e: any) => e.kind === 'admin_family_claimed' && e.to === 'admin@example.com'), 'team is alerted');
  assert.equal((await app.request('/api/admin/emails')).status, 401);

  const test = await json(await post('/api/admin/emails/test', { to: 'someone@example.com' }, admin));
  assert.equal(test.body.ok, true);
  assert.equal(test.body.provider, 'console');

  const csv = await app.request('/api/admin/sponsors.csv', { headers: admin });
  assert.equal(csv.status, 200);
  const text = await csv.text();
  assert.ok(text.startsWith('"Sponsor","Email","Phone"'));
  assert.ok(text.includes('ellie@example.com') && text.includes('313-555-0101'));
});

test('Konnector log in: magic link → session → my families; never reveals whether an email exists', async () => {
  const unknown = await json(await post('/api/account/login', { email: 'nobody@example.com' }, { 'x-forwarded-for': '10.0.0.1' }));
  assert.equal(unknown.status, 200);
  assert.equal(unknown.body.devLink, undefined);
  const known = await json(await post('/api/account/login', { email: 'ellie@example.com' }, { 'x-forwarded-for': '10.0.0.2' }));
  assert.equal(known.status, 200);
  assert.ok(known.body.devLink?.includes('/login?token='));
  assert.equal((await app.request('/api/account/me')).status, 401);
  const token = new URL(known.body.devLink).searchParams.get('token')!;
  assert.equal((await post('/api/admin/auth/verify', { token })).status, 401, 'a Konnector link is not an admin link');
  const v = await post('/api/account/verify', { token });
  assert.equal(v.status, 200);
  const cookie = v.headers.get('set-cookie')!.split(';')[0];
  const me = await json(await app.request('/api/account/me', { headers: { cookie } }));
  assert.equal(me.status, 200);
  assert.equal(me.body.sponsor.email, 'ellie@example.com');
  assert.equal(me.body.families.length, 1);
  assert.ok(me.body.families[0].token);
  assert.ok(!JSON.stringify(me.body).includes('Demo Guardian'));
  const logged = (await store.listActivity({ types: ['message_sent'], limit: 50 })).find((a) => (a.meta as any).kind === 'konnector_login');
  assert.ok(logged && !logged.body.includes('token='), 'sign-in links are not stored in the log');
});

test('sponsor log in treats staff emails like any other address', async () => {
  const before = (await store.listActivity({ types: ['message_sent'], limit: 500 })).length;
  const res = await json(await post('/api/account/login', { email: 'admin@example.com' }, { 'x-forwarded-for': '10.0.0.3' }));
  assert.equal(res.status, 200);
  assert.equal(res.body.devLink, undefined, 'no admin link from the sponsor form');
  const sent = (await store.listActivity({ types: ['message_sent'], limit: 500 })).slice(0, (await store.listActivity({ types: ['message_sent'], limit: 500 })).length - before);
  assert.ok(sent.some((a) => (a.meta as any).kind === 'konnector_no_account' && a.subject.includes('not a sponsor')));
  assert.ok(!sent.some((a) => (a.meta as any).kind === 'admin_login'));
});

test('Konnector updates and notes reach the team recipients from Settings, even with activity alerts off', async () => {
  const req = await json(await post('/api/admin/auth/request', { email: 'admin@example.com' }));
  const verify = await post('/api/admin/auth/verify', { token: new URL(req.body.devLink).searchParams.get('token')! });
  const admin = { cookie: verify.headers.get('set-cookie')!.split(';')[0] };
  const patch = (body: unknown) => app.request('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...admin } });
  assert.equal((await patch({ alertEmails: 'not-an-email' })).status, 400);
  assert.equal((await patch({ alertEmails: 'Ops@Example.com, lead@example.com', adminAlerts: false })).status, 200);
  const pub = await (await app.request('/api/settings')).json();
  assert.equal(pub.alertEmails, undefined, 'team recipients are never public');

  const sp = (await store.listSponsorships({ status: ['Claimed'] })).find((s) => !s.flagged)!;
  assert.equal((await post(`/api/sponsor/${sp.token}/note`, { note: 'Shopping this weekend!' })).status, 200);
  assert.equal((await post(`/api/sponsor/${sp.token}/status`, { status: 'Shopping' })).status, 200);
  const log = (await store.listActivity({ types: ['message_sent'], limit: 50 })).filter((a) => a.sponsorshipId === sp.id).map((a) => a.meta as any);
  for (const kind of ['admin_konnector_note', 'admin_konnector_update']) {
    assert.deepEqual(log.filter((m) => m.kind === kind).map((m) => m.to).sort(), ['lead@example.com', 'ops@example.com'], kind);
  }
  await patch({ alertEmails: '', adminAlerts: true });
});

test('a signed-in sponsor claiming for another org keeps their account and the difference is noted', async () => {
  const taken = new Set((await store.listSponsorships({ status: ['Claimed'] })).map((s) => s.familyId));
  const fresh = (await store.listFamilies({ status: ['Available'] })).find((f) => !taken.has(f.id))!;
  const res = await (await post(`/api/families/${fresh.slug}/claim`, { name: 'Ellie Email', email: 'ellie@example.com', organization: 'Eastside Rotary', agree: true, emailConsent: true }, { 'x-forwarded-for': '10.0.1.1' })).json();
  const sp = (await store.getSponsorshipByToken(res.token))!;
  assert.ok(sp.adminNotes === '' || !sp.adminNotes.includes('Name given'), 'same name is not noted');
  const sponsor = (await store.findSponsorByEmail('ellie@example.com'))!;
  assert.equal(sponsor.organization, 'Eastside Rotary', 'a blank organization is filled in');
  const fresh2 = (await store.listFamilies({ status: ['Available'] })).find((f) => f.id !== fresh.id && !taken.has(f.id))!;
  const res2 = await (await post(`/api/families/${fresh2.slug}/claim`, { name: 'Ellie Email', email: 'ellie@example.com', organization: 'Westside Church', agree: true, emailConsent: true }, { 'x-forwarded-for': '10.0.1.2' })).json();
  assert.ok(res2.token, JSON.stringify(res2));
  const sp2 = (await store.getSponsorshipByToken(res2.token))!;
  assert.match(sp2.adminNotes, /On behalf of: Westside Church/);
  assert.equal((await store.findSponsorByEmail('ellie@example.com'))!.organization, 'Eastside Rotary');
});

test('families can choose their nickname; admins can change it; neither may identify the family', async () => {
  const base = {
    eligibilityConfirmed: true, guardianName: 'Nina Okafor', phone: '313-555-7777', email: '', address: '1 Nick St', city: 'Detroit', state: 'MI', zip: '48202', transportation: 'Yes',
    children: [{ name: 'Zara Okafor', age: 7, gender: 'Girl', clothingCategory: 'Youth / Kids', shirtSize: '8', pantsSize: '8', shoeCategory: 'Youth / Kids', shoeSize: '1', favoriteColor: 'Pink', giftTypes: ['Books'], clothingWishlist: ['Winter Coat'] }],
  };
  const bad = await json(await post('/api/register', { ...base, nickname: 'The Okafor Readers' }, { 'x-forwarded-for': '10.0.2.1' }));
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /last names/);
  const ok = await json(await post('/api/register', { ...base, nickname: '  The Cozy Bookworms ' }, { 'x-forwarded-for': '10.0.2.2' }));
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const fam = (await store.getFamilyByCode(ok.body.familyId))!;
  assert.equal(fam.nickname, 'The Cozy Bookworms');
  const auto = await json(await post('/api/register', base, { 'x-forwarded-for': '10.0.2.3' }));
  assert.match((await store.getFamilyByCode(auto.body.familyId))!.nickname, /^The \w+ Readers$/, 'empty nickname gets a suggestion');

  const req = await json(await post('/api/admin/auth/request', { email: 'admin@example.com' }));
  const verify = await post('/api/admin/auth/verify', { token: new URL(req.body.devLink).searchParams.get('token')! });
  const admin = { cookie: verify.headers.get('set-cookie')!.split(';')[0], 'content-type': 'application/json' };
  const rename = (nickname: string) => app.request(`/api/admin/families/${fam.id}`, { method: 'PATCH', body: JSON.stringify({ nickname }), headers: admin });
  assert.equal((await rename('Nina’s Crew')).status, 400);
  const good = await json(await rename('The Story Seekers'));
  assert.equal(good.body.public.nickname, 'The Story Seekers');
});
