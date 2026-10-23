import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPublicFamily, deriveNickname, colorToHex } from './derive.ts';
import { canTransition } from './status.ts';
import { ChildInputSchema, FamilyApplicationSchema } from './schemas.ts';
import type { Family, Child } from './types.ts';

const child = (over: Partial<Child> = {}): Child => ({
  id: 'c1', familyId: 'f1', name: 'Jordan Smith', age: 8, gender: 'Male', clothingCategory: 'Youth / Kids', shirtSize: '12', pantsSize: '12',
  shoeCategory: 'Youth / Kids', shoeSize: '3', sizeNotes: '', favoriteColor: 'Purple', hobbies: 'Drawing', clothingWishlist: ['Winter Coat'],
  otherClothing: '', giftTypes: ['Art Supplies'], specificGifts: '', sortOrder: 0, ...over,
});

const family: Family = {
  id: 'f1', familyId: 'BF-2026-001', season: '2026', status: 'Available', slug: 'abc', nickname: '', guardianName: 'Pat Smith', phone: '3135551212',
  email: 'pat@example.com', preferredContact: 'Text', address: '1 Main', city: 'Detroit', state: 'MI', zip: '48201', transportation: 'Yes',
  familyStory: 'We love art.', storyApproved: false, eligibilityConfirmed: true, notes: '', adminNotes: '', views: 0, claimStarts: 0,
  createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), approvedAt: null, fulfilledAt: null, children: [child()],
};

test('public view strips private data and hides unapproved story', () => {
  const p = toPublicFamily(family);
  assert.equal(p.children[0].name, 'Jordan');
  assert.equal(p.story, '');
  assert.equal(p.daysWaiting, 3);
  assert.ok(p.tags.includes('Needs winter coats'));
  assert.deepEqual(p.colors, ['#6250d6']);
  assert.ok(!JSON.stringify(p).includes('Pat Smith'));
  assert.ok(!JSON.stringify(p).includes('48201'));
});

test('nickname is deterministic and interest based', () => {
  assert.equal(deriveNickname([child()], 'BF-2026-001'), deriveNickname([child()], 'BF-2026-001'));
  assert.match(deriveNickname([child()], 'x'), /Artists$/);
});

test('color lookup', () => {
  assert.equal(colorToHex('Light Blue'), '#2a78d6');
  assert.equal(colorToHex(''), null);
});

test('dominoes transitions', () => {
  assert.ok(canTransition('Claimed', 'Confirmed'));
  assert.ok(!canTransition('Delivered', 'Claimed'));
  assert.ok(canTransition('Shopping', 'Released'));
});

test('child schema enforces size clarifications for Other', () => {
  const base = { name: 'Ava', age: 5, gender: 'Female', clothingCategory: 'Toddler', shirtSize: 'Other / Not Sure', pantsSize: '5T', shoeCategory: 'Toddler', shoeSize: '12' };
  assert.ok(!ChildInputSchema.safeParse(base).success);
  assert.ok(ChildInputSchema.safeParse({ ...base, sizeNotes: 'between 4T and 5T' }).success);
  assert.ok(!ChildInputSchema.safeParse({ ...base, shirtSize: '12' }).success, 'size must belong to category');
});

test('application requires eligibility and valid zip', () => {
  const app = {
    eligibilityConfirmed: true, guardianName: 'Pat Smith', phone: '313-555-1212', email: '', address: '1 Main', city: 'Detroit', state: 'MI', zip: '48201',
    transportation: 'Yes', children: [{ name: 'Ava', age: 5, gender: 'Female', clothingCategory: 'Toddler', shirtSize: '5T', pantsSize: '5T', shoeCategory: 'Toddler', shoeSize: '12' }],
  };
  assert.ok(FamilyApplicationSchema.safeParse(app).success);
  assert.ok(!FamilyApplicationSchema.safeParse({ ...app, zip: '4820' }).success);
  assert.ok(!FamilyApplicationSchema.safeParse({ ...app, eligibilityConfirmed: false }).success);
});
