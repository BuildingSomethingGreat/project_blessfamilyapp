/** Prints the seed dataset as Airtable record payloads (field IDs) for bulk creation. */
import { familyNickname } from '@bless/shared';
import { SEED_HOUSEHOLDS, SEED_SPONSORS, SEED_SPONSORSHIPS } from '../lib/seed-data.ts';
import { familyCode, shortId, token } from '../lib/ids.ts';

const season = '2026';
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const F = { id: 'fld4XBcMCooZ1fkG2', season: 'fld4bSaf8DAE7Ljo7', status: 'fldpp2r7pNF9SsxFR', slug: 'fldzJGlq4a56ZN3lT', nickname: 'fldoezrguztCQVIAa', guardian: 'fldHu78VNVTwAJsA0', phone: 'fldWzrKTnPwjBCLdj', email: 'fldKpoI9GDHydkVCG', contact: 'fldE8sXmMbxJRNOqx', address: 'fld8cjNXTWEjl1rpC', city: 'fldoVSzdxNBpRZGhg', state: 'fldMzvM9KC29oeKKc', zip: 'fldrobnGUyX9WJo5S', transport: 'fldVB1aRc60XQveov', story: 'fldnu4rvy4V5R8D7u', storyOk: 'fldAb4b5VGKjzjzQM', eligible: 'fldr9Ccm3L47uq6yl', notes: 'fld1TsUkI77yASRQz', views: 'fld9ozdTfxsVsNNDt', starts: 'fldxzshbr3ex0Xl85', approvedAt: 'fldoaOfaHmy5nmDGd', fulfilledAt: 'fldosqQ7MAnwzjTAr', raised: 'fldKidiZce8c1jr2d', goal: 'fldtp8kUpmqV1YvEo' };
const C = { name: 'fldRbeEnNxQUe1ZSl', age: 'fldjoEEV9x89nki0k', gender: 'fldN0Vf3LlwXkdc1t', cat: 'fldmG7QcVmcx7ngVz', shirt: 'fldmtDemZAbJx2py9', pants: 'fldjwOH9LjPKoTlgo', shoeCat: 'fldT4zeMDcXVSpHO0', shoe: 'fld2zJ3TUsZAFnNY0', sizeNotes: 'fldJaQurhxlc6liYs', color: 'fldGEKVs61l95Hm8U', hobbies: 'fldhhjLAXiYfKKPV6', clothing: 'fldVpYbfXaQiVPvKg', otherClothing: 'fldiEATJFBCOzpmTH', gifts: 'fldrVsXf6MGwMGYMO', specific: 'fldmme32YI98Nl3pV', sort: 'fld9HBgfr6xPZRRe7', family: 'fldzEG3g2MivWeCNk' };
const S = { name: 'fldnInVkKecRywhiu', email: 'fldEMloGeO529u23j', phone: 'fld59TMv41ImWoGpC', org: 'fldGO962QXKwknGsW', contact: 'fldFc8uzswXwrK5By', notes: 'fldPgOJMuQhW7mZrZ' };
const P = { id: 'fld8iGy9Qb5I90mp2', status: 'fldXYqw1NmeFxNyBl', token: 'fldqJE29wAjNz8tLg', claimedAt: 'fld5Yp7CM7RktD704', shoppingAt: 'fldulESy4IpdNjtrf', purchasedAt: 'fldhDlEAQL3xz2v4h', wrappedAt: 'flday3i1kkjT0cuaC', droppedAt: 'flduUonbHiYP1Yc4z', deliveredAt: 'fldFuYlwHb0MT8x6G', next: 'fldijnqUb9G51HZqb', nudged: 'fld19ZvFB4KTcosB3', responded: 'fldqri4EfvuPeMw82', count: 'fldktCosu68pLxZYb', flagged: 'fldjpQf6s2LQA7gf4', flagReason: 'fldsyV0K72JcYglKm', note: 'fld5VqrbxbRKtyKyK', family: 'fldlArY6my0OwX8ZT', sponsor: 'fldzr4ZUK82aJsZUY' };
const strip = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null && v !== false));

const families = SEED_HOUSEHOLDS.map((h, i) => {
  const code = familyCode(season, i + 1);
  const kids = h.kids.map((k, j) => ({ ...k, id: '', familyId: '', sortOrder: j }));
  return { fields: strip({
    [F.id]: code, [F.season]: season, [F.status]: h.status, [F.slug]: shortId(), [F.nickname]: familyNickname(code), [F.guardian]: h.guardian, [F.phone]: h.phone, [F.email]: h.email,
    [F.contact]: h.preferredContact, [F.address]: h.address, [F.city]: h.city, [F.state]: 'MI', [F.zip]: h.zip, [F.transport]: h.transportation, [F.story]: h.story, [F.storyOk]: h.storyApproved && !!h.story,
    [F.eligible]: true, [F.notes]: h.notes, [F.views]: h.views, [F.starts]: h.claimStarts, [F.approvedAt]: ['Submitted', 'Needs Info'].includes(h.status) ? undefined : daysAgo(Math.max(0, h.createdDaysAgo - 1)),
    [F.fulfilledAt]: h.status === 'Fulfilled' ? daysAgo(3) : undefined, [F.raised]: h.raised ?? 0, [F.goal]: 150 * h.kids.length,
  }) };
});
const children = SEED_HOUSEHOLDS.map((h, i) => h.kids.map((k, j) => ({ familyIndex: i, fields: strip({
  [C.name]: k.name, [C.age]: k.age, [C.gender]: k.gender, [C.cat]: k.clothingCategory, [C.shirt]: k.shirtSize, [C.pants]: k.pantsSize, [C.shoeCat]: k.shoeCategory, [C.shoe]: k.shoeSize,
  [C.sizeNotes]: k.sizeNotes, [C.color]: k.favoriteColor, [C.hobbies]: k.hobbies, [C.clothing]: k.clothingWishlist.length ? k.clothingWishlist : undefined, [C.otherClothing]: k.otherClothing,
  [C.gifts]: k.giftTypes.length ? k.giftTypes : undefined, [C.specific]: k.specificGifts, [C.sort]: j,
}) }))).flat();
const sponsors = SEED_SPONSORS.map((s) => ({ fields: strip({ [S.name]: s.name, [S.email]: s.email, [S.phone]: s.phone, [S.org]: s.organization, [S.contact]: s.preferredContact, [S.notes]: s.notes }) }));
const order = ['Shopping', 'Purchased', 'Wrapped', 'Dropped Off', 'Delivered'];
const sponsorships = SEED_SPONSORSHIPS.map((s, n) => {
  const at = (st: string, off: number) => (order.indexOf(s.status) >= order.indexOf(st) ? daysAgo(Math.max(0, s.claimedDaysAgo - off)) : undefined);
  return { familyIndex: s.householdIdx, sponsorIndex: s.sponsorIdx, fields: strip({
    [P.id]: `SP-${season}-${String(n + 1).padStart(3, '0')}`, [P.status]: s.status, [P.token]: token(), [P.claimedAt]: daysAgo(s.claimedDaysAgo), [P.shoppingAt]: at('Shopping', 2), [P.purchasedAt]: at('Purchased', 4),
    [P.wrappedAt]: at('Wrapped', 6), [P.droppedAt]: at('Dropped Off', 9), [P.deliveredAt]: at('Delivered', 12), [P.next]: s.status === 'Delivered' || s.flagged ? undefined : s.status === 'Shopping' ? daysAgo(0.5) : daysAgo(-3),
    [P.nudged]: s.lastNudgedDaysAgo === null ? undefined : daysAgo(s.lastNudgedDaysAgo), [P.responded]: s.lastResponseDaysAgo === null ? undefined : daysAgo(s.lastResponseDaysAgo), [P.count]: s.followUpCount,
    [P.flagged]: !!s.flagged, [P.flagReason]: s.flagged ? `No response after ${s.followUpCount} follow-ups` : undefined, [P.note]: s.note,
  }) };
});
console.log(JSON.stringify({ families, children, sponsors, sponsorships, linkFields: { childFamily: C.family, spFamily: P.family, spSponsor: P.sponsor } }));
