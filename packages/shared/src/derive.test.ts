import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPublicFamily, familyNickname, nicknameProblem, colorToHex } from './derive.ts';
import { canTransition } from './status.ts';
import { ChildInputSchema, FamilyApplicationSchema } from './schemas.ts';
import type { Family, Child } from './types.ts';
import { GOAL_PER_CHILD } from './sizes.ts';

const child = (over: Partial<Child> = {}): Child => ({
  id: 'c1', familyId: 'f1', name: 'Jordan Smith', age: 8, gender: 'Boy', clothingCategory: 'Youth / Kids', shirtSize: '12', pantsSize: '12',
  shoeCategory: 'Youth / Kids', shoeSize: '3', sizeNotes: '', favoriteColor: 'Purple', hobbies: 'Drawing', clothingWishlist: ['Winter Coat'],
  otherClothing: '', giftTypes: ['Art Supplies'], specificGifts: '', sortOrder: 0, ...over,
});

const family: Family = {
  id: 'f1', familyId: 'BF-2026-001', season: '2026', status: 'Available', slug: 'abc', nickname: '', guardianName: 'Pat Smith', phone: '3135551212',
  email: 'pat@example.com', preferredContact: 'Text', address: '1 Main', city: 'Detroit', state: 'MI', zip: '48201', transportation: 'Yes',
  familyStory: 'We love art.', storyApproved: false, photoUrl: 'data:image/png;base64,xx', photoApproved: false, photoPrivate: false, raised: 0, goal: 0, eligibilityConfirmed: true, notes: '', adminNotes: '', views: 0, claimStarts: 0,
  createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), approvedAt: null, fulfilledAt: null, children: [child()],
};

test('public view strips private data and hides unapproved story', () => {
  const p = toPublicFamily(family);
  assert.equal(p.children[0].name, 'Jordan');
  assert.equal(p.story, '');
  assert.equal(p.daysWaiting, 3);
  assert.ok(p.tags.includes('Needs a winter coat'));
  assert.deepEqual(p.colors, ['#7c5cff']);
  assert.equal(p.photoUrl, '', 'photo hidden until approved');
  assert.equal(p.goal, GOAL_PER_CHILD, 'falls back to the per-child goal when no goal is stored');
  assert.equal(p.kidLine, '1 child');
  assert.ok(!JSON.stringify(p).includes('Pat Smith'));
  assert.ok(!JSON.stringify(p).includes('48201'));
});

test('a family can keep its photo private even after staff approve it', () => {
  assert.equal(toPublicFamily({ ...family, photoApproved: true }).photoUrl, family.photoUrl);
  assert.equal(toPublicFamily({ ...family, photoApproved: true, photoPrivate: true }).photoUrl, '');
});

test('age and need tags are plain-language', () => {
  const p = toPublicFamily({ ...family, children: [child({ age: 1, clothingWishlist: ['Boots'] }), child({ age: 15, clothingWishlist: [] })] });
  assert.ok(p.tags.includes('Baby or toddler'));
  assert.ok(p.tags.includes('Teen'));
  assert.ok(p.tags.includes('Needs boots'));
  assert.ok(!p.tags.includes('Needs a winter coat'));
});

test('families are listed by number', () => {
  assert.equal(familyNickname('BF-2026-001'), 'Bless-a-Family #1');
  assert.equal(familyNickname('BF-2026-112'), 'Bless-a-Family #112');
});

test('color lookup', () => {
  assert.equal(colorToHex('Light Blue'), '#2a78d6');
  assert.equal(colorToHex(''), null);
});

test('dominoes transitions', () => {
  assert.ok(canTransition('Claimed', 'Shopping'));
  assert.ok(canTransition('Purchased', 'Wrapped'));
  assert.ok(!canTransition('Delivered', 'Claimed'));
  assert.ok(canTransition('Shopping', 'Released'));
});

test('child schema enforces size clarifications for Other', () => {
  const base = { name: 'Ava', age: 5, gender: 'Girl', clothingCategory: 'Toddler', shirtSize: 'Other / Not Sure', pantsSize: '5T', shoeCategory: 'Toddler', shoeSize: '12' };
  assert.ok(!ChildInputSchema.safeParse(base).success);
  assert.ok(ChildInputSchema.safeParse({ ...base, sizeNotes: 'between 4T and 5T' }).success);
  assert.ok(!ChildInputSchema.safeParse({ ...base, shirtSize: '12' }).success, 'size must belong to category');
});

test('application requires eligibility and valid zip', () => {
  const app = {
    eligibilityConfirmed: true, guardianName: 'Pat Smith', phone: '313-555-1212', email: '', address: '1 Main', city: 'Detroit', state: 'MI', zip: '48201',
    transportation: 'Yes', children: [{ name: 'Ava', age: 5, gender: 'Girl', clothingCategory: 'Toddler', shirtSize: '5T', pantsSize: '5T', shoeCategory: 'Toddler', shoeSize: '12' }],
  };
  assert.ok(FamilyApplicationSchema.safeParse(app).success);
  assert.ok(!FamilyApplicationSchema.safeParse({ ...app, zip: '4820' }).success);
  assert.ok(!FamilyApplicationSchema.safeParse({ ...app, eligibilityConfirmed: false }).success);
});

test('nicknames cannot identify the family', () => {
  const priv = { guardianName: 'Dana Whitfield', childNames: ['Ava Whitfield', 'Leo'] };
  assert.equal(nicknameProblem('The Cozy Readers', priv), null);
  assert.equal(nicknameProblem('Team Ava & Leo', priv), null, 'kids first names are already public');
  assert.match(nicknameProblem('The Whitfield Crew', priv)!, /last names/);
  assert.match(nicknameProblem('Dana and the kids', priv)!, /parent/);
  assert.match(nicknameProblem('The 4521 Elm Family', priv)!, /numbers/);
  assert.match(nicknameProblem('Hi', priv)!, /between/);
  assert.match(nicknameProblem('<script>', priv)!, /letters/);
});
