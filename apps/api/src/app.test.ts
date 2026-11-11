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

test('claims start as drop-off (staff can allow direct delivery) and record wall opt-in; the wall only shows names after hand-off', async () => {
  const taken = new Set((await store.listSponsorships({ status: ['Claimed'] })).map((s) => s.familyId));
  const fresh = (await store.listFamilies({ status: ['Available'] })).find((f) => !taken.has(f.id))!;
  const res = await (await post(`/api/families/${fresh.slug}/claim`, { name: 'Wanda Wall', email: 'wanda@example.com', agree: true, emailConsent: true, handoff: 'Deliver directly', wallOptIn: true, displayName: 'The Wall Family' })).json();
  assert.ok(res.token, JSON.stringify(res));
  const sp = (await store.getSponsorshipByToken(res.token))!;
  assert.equal(sp.handoff, 'Drop off', 'public claims are always drop-off; staff choose who may deliver directly');
  const req = await json(await post('/api/admin/auth/request', { email: 'admin@example.com' }));
  const verify = await post('/api/admin/auth/verify', { token: new URL(req.body.devLink).searchParams.get('token')! });
  const admin = { cookie: verify.headers.get('set-cookie')!.split(';')[0], 'content-type': 'application/json' };
  const switched = await json(await app.request(`/api/admin/sponsorships/${sp.id}`, { method: 'PATCH', body: JSON.stringify({ handoff: 'Deliver directly' }), headers: admin }));
  assert.equal(switched.body.handoff, 'Deliver directly');
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

test('families are listed as Bless-a-Family #N; admins can rename but not with identifying details', async () => {
  const base = {
    eligibilityConfirmed: true, guardianName: 'Nina Okafor', phone: '313-555-7777', email: '', address: '1 Nick St', city: 'Detroit', state: 'MI', zip: '48202', transportation: 'Yes',
    children: [{ name: 'Zara Okafor', age: 7, gender: 'Girl', clothingCategory: 'Youth / Kids', shirtSize: '8', pantsSize: '8', shoeCategory: 'Youth / Kids', shoeSize: '1', favoriteColor: 'Pink', giftTypes: ['Books'], clothingWishlist: ['Winter Coat'] }],
  };
  const ok = await json(await post('/api/register', { ...base, nickname: 'Ignored', photoDataUrl: 'data:image/png;base64,AAAA' }, { 'x-forwarded-for': '10.0.2.2' }));
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const fam = (await store.getFamilyByCode(ok.body.familyId))!;
  const n = Number(ok.body.familyId.split('-').pop());
  assert.equal(fam.nickname, `Bless-a-Family #${n}`);
  assert.equal(fam.photoUrl, '', 'families no longer send photos');

  const req = await json(await post('/api/admin/auth/request', { email: 'admin@example.com' }));
  const verify = await post('/api/admin/auth/verify', { token: new URL(req.body.devLink).searchParams.get('token')! });
  const admin = { cookie: verify.headers.get('set-cookie')!.split(';')[0], 'content-type': 'application/json' };
  const rename = (nickname: string) => app.request(`/api/admin/families/${fam.id}`, { method: 'PATCH', body: JSON.stringify({ nickname }), headers: admin });
  assert.equal((await rename('Nina’s Crew')).status, 400);
  const good = await json(await rename('The Story Seekers'));
  assert.equal(good.body.public.nickname, 'The Story Seekers');
  const reset = await json(await rename(''));
  assert.equal(reset.body.public.nickname, `Bless-a-Family #${n}`, 'an empty name falls back to the number');
});

test('gift follow-ups are required on the application and shown to Konnectors', async () => {
  const base = {
    eligibilityConfirmed: true, guardianName: 'Gia Follow', phone: '313-555-6161', email: '', address: '2 Gift St', city: 'Detroit', state: 'MI', zip: '48202', transportation: 'Yes',
  };
  const kid = { name: 'Ty', age: 11, gender: 'Boy', clothingCategory: 'Youth / Kids', shirtSize: '12', pantsSize: '12', shoeCategory: 'Youth / Kids', shoeSize: '5', favoriteColor: 'Red', giftTypes: ['Video Games', 'Books'], clothingWishlist: ['Hoodies'] };
  const missing = await json(await post('/api/register', { ...base, children: [kid] }, { 'x-forwarded-for': '10.0.3.1' }));
  assert.equal(missing.status, 400, 'game system is required when Video Games is picked');
  const ok = await json(await post('/api/register', { ...base, children: [{ ...kid, giftDetails: { vg_system: 'Nintendo Switch', vg_games: 'Mario Kart', books_level: 'Middle grade', sport: 'Soccer' } }] }, { 'x-forwarded-for': '10.0.3.2' }));
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const fam = (await store.getFamilyByCode(ok.body.familyId))!;
  assert.deepEqual(fam.children[0].giftDetails, { vg_system: 'Nintendo Switch', vg_games: 'Mario Kart', books_level: 'Middle grade' }, 'answers for gifts not picked are dropped');
  await store.updateFamily(fam.id, { status: 'Available' });
  const pub = await json(await app.request(`/api/families/${fam.slug}`));
  assert.equal(pub.body.children[0].giftDetails.vg_system, 'Nintendo Switch');
});

test('admins can edit household details and children after approval', async () => {
  const req = await json(await post('/api/admin/auth/request', { email: 'admin@example.com' }));
  const verify = await post('/api/admin/auth/verify', { token: new URL(req.body.devLink).searchParams.get('token')! });
  const admin = { cookie: verify.headers.get('set-cookie')!.split(';')[0], 'content-type': 'application/json' };
  const fam = (await store.listFamilies({ status: ['Available'] })).find((f) => f.children.length >= 2)!;
  const [first, second] = fam.children;
  const body = {
    guardianName: 'Updated Guardian', phone: '(313) 555-0000', email: 'new@example.com', preferredContact: 'Email', address: '99 New Ave', city: 'Detroit', state: 'mi', zip: '48201', transportation: 'No',
    familyStory: 'Updated story', notes: '',
    children: [
      { ...first, shirtSize: 'Legacy XL', giftTypes: ['Gift Card to a Store'], giftDetails: { gc_store: 'Target' } },
      { name: 'New Baby', age: 0, gender: 'Prefer not to say', clothingCategory: 'Baby / Infant', shirtSize: '6-9M', pantsSize: '6-9M', shoeCategory: 'Baby / Infant', shoeSize: '2', clothingWishlist: [], giftTypes: [] },
    ],
  };
  const save = (b: unknown) => app.request(`/api/admin/families/${fam.id}/details`, { method: 'PUT', body: JSON.stringify(b), headers: admin });
  assert.equal((await app.request(`/api/admin/families/${fam.id}/details`, { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })).status, 401);
  assert.equal((await save({ ...body, children: [] })).status, 400, 'a family keeps at least one child');
  const res = await json(await save(body));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const after = (await store.getFamily(fam.id))!;
  assert.equal(after.guardianName, 'Updated Guardian');
  assert.equal(after.state, 'MI');
  assert.equal(after.status, 'Available', 'status is untouched by a details edit');
  assert.equal(after.children.length, 2);
  assert.equal(after.children[0].id, first.id, 'existing child is updated in place');
  assert.equal(after.children[0].shirtSize, 'Legacy XL', 'admins can keep a size outside the current lists');
  assert.deepEqual(after.children[0].giftDetails, { gc_store: 'Target' });
  assert.equal(after.children[1].name, 'New Baby');
  assert.ok(!after.children.some((k) => k.id === second.id), 'a child left out is removed');
  const pub = await json(await app.request(`/api/families/${fam.slug}`));
  assert.equal(pub.body.children.length, 2);
  assert.ok(!JSON.stringify(pub.body).includes('Updated Guardian') && !JSON.stringify(pub.body).includes('99 New Ave'), 'private fields stay private');
});

test('co-sponsor teams: invite on claim, join by link, same access and emails, up to 6 people, leave', async () => {
  const { konnectorInviteToken } = await import('./lib/auth.ts');
  let n = 0;
  const freshFamily = async () => {
    const { id: _id, createdAt: _c, children, ...rest } = (await store.listFamilies())[0]!;
    n++;
    return store.createFamily({ ...rest, familyId: `BF-TEAM-${n}`, slug: `team-${n}-${Date.now()}`, status: 'Available', children: children.map(({ id: _i, familyId: _f, ...c }) => c) });
  };
  const cookieOf = (res: Response) => res.headers.get('set-cookie')!.split(';')[0]!;
  const get = (path: string, cookie?: string) => app.request(path, { headers: cookie ? { cookie } : {} });
  const call = (method: string, path: string, body: unknown, cookie?: string) => app.request(path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) } });

  // Claim with two teammates (and a mistaken self-invite).
  const f1 = await freshFamily();
  const claimRes = await post(`/api/families/${f1.slug}/claim`, { name: 'Owen Owner', email: 'owen@example.com', agree: true, emailConsent: true, team: [{ name: 'Tia Team', email: 'Tia@Example.com' }, { name: 'Max Mate', email: 'max@example.com' }, { name: 'Owen', email: 'owen@example.com' }] }, { 'x-forwarded-for': '10.0.2.1' });
  const claim = await claimRes.json();
  assert.equal(claimRes.status, 200, JSON.stringify(claim));
  assert.deepEqual(claim.team.invited.map((m: any) => m.email).sort(), ['max@example.com', 'tia@example.com']);
  assert.equal(claim.team.skipped.length, 1);
  const owen = cookieOf(claimRes);
  const invites = (await store.listActivity({ types: ['message_sent'], limit: 50 })).filter((a) => (a.meta as any).kind === 'team_invite');
  assert.deepEqual(invites.map((a) => (a.meta as any).to).sort(), ['max@example.com', 'tia@example.com']);
  assert.ok(invites.every((a) => !a.body.includes('token=')), 'join links stay out of the email log');
  const owner = (await store.findSponsorByEmail('owen@example.com'))!;
  assert.ok(owner.teamId);
  const sp = (await store.getSponsorshipByToken(claim.token))!;

  // A pending invitee sees nothing yet and gets no family emails.
  const tiaLogin = await json(await post('/api/account/login', { email: 'tia@example.com' }, { 'x-forwarded-for': '10.0.2.2' }));
  const tiaPending = cookieOf(await post('/api/account/verify', { token: new URL(tiaLogin.body.devLink).searchParams.get('token')! }));
  const pending = await json(await get('/api/account/me', tiaPending));
  assert.equal(pending.body.families.length, 0);
  assert.equal(pending.body.invite.from, 'Owen Owner');
  await services.followUp.send('confirm_nudge', sp);
  let nudges = (await store.listActivity({ types: ['message_sent'], limit: 50 })).filter((a) => a.sponsorshipId === sp.id && (a.meta as any).kind === 'confirm_nudge').map((a) => (a.meta as any).to);
  assert.deepEqual(nudges, ['owen@example.com']);

  // Tia joins from her invite link: same families, same emails.
  const join = await post('/api/account/verify', { token: konnectorInviteToken('tia@example.com', owner.teamId) });
  assert.equal((await join.clone().json()).team.joined, true);
  const tia = cookieOf(join);
  const tiaMe = await json(await get('/api/account/me', tia));
  assert.deepEqual(tiaMe.body.families.map((f: any) => f.token), [claim.token]);
  assert.equal(tiaMe.body.families[0].claimedBy, 'Owen Owner');
  assert.deepEqual(tiaMe.body.team.map((m: any) => `${m.name}:${m.status}`), ['Owen Owner:Joined', 'Tia Team:Joined', 'Max Mate:Invited']);
  await services.followUp.send('confirm_nudge', sp);
  nudges = (await store.listActivity({ types: ['message_sent'], limit: 50 })).filter((a) => a.sponsorshipId === sp.id && (a.meta as any).kind === 'confirm_nudge').map((a) => (a.meta as any).to);
  assert.deepEqual(nudges.slice(0, 2).sort(), ['owen@example.com', 'tia@example.com'], 'joined teammates get their own copy; pending invitees do not');

  // On the family page she is herself, and can update progress like Owen.
  const view = await json(await get(`/api/sponsor/${claim.token}`, tia));
  assert.equal(view.body.viewer.name, 'Tia Team');
  assert.equal(view.body.viewer.claimedThis, false);
  const bubbles = view.body.timeline.filter((m: any) => m.type === 'message_sent');
  const keys = bubbles.map((m: any) => `${m.subject}|${m.occurredAt.slice(0, 16)}`);
  assert.equal(new Set(keys).size, keys.length, 'each email shows once on the family page, not once per teammate');
  assert.ok(bubbles.some((m: any) => m.body.includes('Hi Tia')), "the viewer sees their own copy");
  assert.equal((await call('POST', `/api/sponsor/${claim.token}/status`, { status: 'Shopping' }, tia)).status, 200);

  // Up to 6 people counting invites: Owen, Tia, Max (invited) + 3 more; the 4th is turned away.
  const more = await json(await call('POST', `/api/sponsor/${claim.token}/team`, { invites: ['a', 'b', 'c', 'd'].map((x) => ({ name: `Pal ${x.toUpperCase()}`, email: `pal-${x}@example.com` })) }, tia));
  assert.equal(more.status, 200, JSON.stringify(more.body));
  assert.equal(more.body.invited.length, 3);
  assert.equal(more.body.skipped[0].email, 'pal-d@example.com');
  assert.equal(more.body.view.team.length, 6);
  assert.ok(more.body.view.team.filter((m: any) => m.name.startsWith('Pal')).every((m: any) => m.invitedBy === 'Tia Team'));

  // Anyone can cancel an invite; joined teammates can't remove each other.
  assert.equal((await call('DELETE', `/api/account/team/${owner.id}`, undefined, tia)).status, 403);
  const max = (await store.findSponsorByEmail('max@example.com'))!;
  assert.equal((await call('DELETE', `/api/account/team/${max.id}`, undefined, tia)).status, 200);
  const late = await (await post('/api/account/verify', { token: konnectorInviteToken('max@example.com', owner.teamId) })).json();
  assert.equal(late.team.joined, false, 'a cancelled invite only signs them in');
  assert.equal((await store.findSponsorByEmail('max@example.com'))!.teamId, '');

  // A family Tia chooses shows up for Owen too; admins see the team.
  const f2 = await freshFamily();
  const tiaClaim = await (await post(`/api/families/${f2.slug}/claim`, { name: 'Tia Team', email: 'tia@example.com', agree: true, emailConsent: true }, { 'x-forwarded-for': '10.0.2.3' })).json();
  const owenMe = await json(await get('/api/account/me', owen));
  assert.deepEqual(owenMe.body.families.map((f: any) => f.token).sort(), [claim.token, tiaClaim.token].sort());
  const req = await json(await post('/api/admin/auth/request', { email: 'admin@example.com' }));
  const admin = cookieOf(await post('/api/admin/auth/verify', { token: new URL(req.body.devLink).searchParams.get('token')! }));
  const board = await json(await get('/api/admin/sponsorships', admin));
  const row = board.body.find((s: any) => s.id === sp.id);
  assert.ok(row.team.some((m: any) => m.email === 'tia@example.com' && m.status === 'Joined'));
  const csv = await (await get('/api/admin/sponsors.csv', admin)).text();
  assert.ok(csv.split('\n')[0]!.includes('Team') && csv.includes('Tia Team <tia@example.com>'));
  assert.ok(!JSON.stringify(await (await app.request(`/api/families/${f1.slug}`)).json()).includes('tia@example.com'), 'teams never reach the public family page');

  // Tia leaves: she keeps her own family, Owen stops seeing it, and she stops getting Owen's emails.
  assert.equal((await call('DELETE', `/api/account/team/${tiaMe.body.sponsor.id}`, undefined, tia)).status, 200);
  assert.deepEqual((await json(await get('/api/account/me', owen))).body.families.map((f: any) => f.token), [claim.token]);
  assert.deepEqual((await json(await get('/api/account/me', tia))).body.families.map((f: any) => f.token), [tiaClaim.token]);
  const solo = await json(await get(`/api/sponsor/${claim.token}`, tia));
  assert.equal(solo.body.viewer, null);
});
