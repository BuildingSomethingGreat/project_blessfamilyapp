import type { Store } from '../store/types.ts';
import type { NewChild } from '../store/types.ts';
import { deriveNickname } from '@bless/shared';
import { familyCode, shortId, token, nowIso } from './ids.ts';

const kid = (o: Partial<NewChild> & { name: string; age: number }): NewChild => ({
  gender: 'Girl', clothingCategory: 'Youth / Kids', shirtSize: '10', pantsSize: '10', shoeCategory: 'Youth / Kids', shoeSize: '3', sizeNotes: '',
  favoriteColor: 'Blue', hobbies: '', clothingWishlist: [], otherClothing: '', giftTypes: [], specificGifts: '', sortOrder: 0, ...o,
});

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

/** Realistic demo households. Names are fictional. */
export async function seedDemo(store: Store) {
  const season = '2026';
  const households: { status: 'Available' | 'Claimed' | 'Fulfilled' | 'Submitted'; createdDaysAgo: number; story: string; approved: boolean; city: string; kids: NewChild[]; views: number; claimStarts: number; raised?: number }[] = [
    {
      status: 'Available', createdDaysAgo: 21, approved: true, city: 'Detroit', views: 48, claimStarts: 3, raised: 120,
      story: "I'm a single mom of three and we moved twice this year. The kids have been so brave about it. Jordan draws every single day and Maya wants to be a vet. A warm coat for each of them would mean the world.",
      kids: [
        kid({ name: 'Jordan', age: 8, gender: 'Boy', shirtSize: '10', pantsSize: '10', shoeSize: '3', favoriteColor: 'Purple', hobbies: 'Drawing, comics', clothingWishlist: ['Winter Coat', 'Hoodies', 'Jeans'], giftTypes: ['Art Supplies', 'Books'], specificGifts: 'Sketchbook and markers' }),
        kid({ name: 'Maya', age: 5, clothingCategory: 'Toddler', shirtSize: '5T', pantsSize: '5T', shoeCategory: 'Toddler', shoeSize: '11', favoriteColor: 'Pink', hobbies: 'Animals', clothingWishlist: ['Winter Coat', 'Pajamas', 'Boots'], giftTypes: ['Toys / Dolls', 'Puzzles'], specificGifts: 'Anything with animals' }),
        kid({ name: 'Eli', age: 1, gender: 'Boy', clothingCategory: 'Baby / Infant', shirtSize: '12–18 Months', pantsSize: '12–18 Months', shoeCategory: 'Baby / Infant', shoeSize: '4', favoriteColor: 'Yellow', clothingWishlist: ['Pajamas', 'Socks'], giftTypes: ['Educational Games'], specificGifts: 'Stacking toys' }),
      ],
    },
    {
      status: 'Available', createdDaysAgo: 14, approved: true, city: 'Southfield', views: 31, claimStarts: 1,
      story: 'Grandma raising two grandkids. Both are on the honor roll and both have outgrown everything since last winter.',
      kids: [
        kid({ name: 'Destiny', age: 13, clothingCategory: "Women's", shirtSize: 'S', pantsSize: '4', shoeCategory: "Women's", shoeSize: '7', favoriteColor: 'Black', hobbies: 'Volleyball, music', clothingWishlist: ['Winter Coat', 'Leggings', 'Sweatshirts'], giftTypes: ['Sports Equipment', 'Music Items', 'Gift Card to a Store'] }),
        kid({ name: 'Marcus', age: 11, gender: 'Boy', shirtSize: '14', pantsSize: '14', shoeSize: '6', favoriteColor: 'Green', hobbies: 'Basketball, LEGO', clothingWishlist: ['Jacket', 'Shoes / Sneakers', 'Socks'], giftTypes: ['Building Sets / LEGO', 'Sports Equipment'] }),
      ],
    },
    {
      status: 'Available', createdDaysAgo: 9, approved: true, city: 'Detroit', views: 12, claimStarts: 0,
      story: '',
      kids: [kid({ name: 'Aaliyah', age: 3, clothingCategory: 'Toddler', shirtSize: '4T', pantsSize: '3T', shoeCategory: 'Toddler', shoeSize: '9', favoriteColor: 'Rainbow', hobbies: 'Dancing', clothingWishlist: ['Dresses', 'Winter Coat', 'Gloves', 'Hat'], giftTypes: ['Toys / Dolls', 'Music Items'], sizeNotes: 'Tall for her age' })],
    },
    {
      status: 'Available', createdDaysAgo: 30, approved: true, city: 'Oak Park', views: 67, claimStarts: 4, raised: 275,
      story: "Four kids, one bathroom, a lot of laughter. Dad works nights. We'd be grateful for anything, but the boys desperately need boots.",
      kids: [
        kid({ name: 'Isaiah', age: 15, gender: 'Boy', clothingCategory: "Men's", shirtSize: 'L', pantsSize: '32', shoeCategory: "Men's", shoeSize: '11', favoriteColor: 'Red', hobbies: 'Football, gaming', clothingWishlist: ['Boots', 'Winter Coat', 'Sweatpants'], giftTypes: ['Video Games', 'Gift Card to a Store'] }),
        kid({ name: 'Noah', age: 12, gender: 'Boy', shirtSize: '16', pantsSize: '16', shoeSize: '7', favoriteColor: 'Blue', hobbies: 'Science, Minecraft', clothingWishlist: ['Boots', 'Hoodies'], giftTypes: ['Building Sets / LEGO', 'Educational Games'] }),
        kid({ name: 'Grace', age: 9, shirtSize: '10', pantsSize: '10', shoeSize: '4', favoriteColor: 'Lavender', hobbies: 'Reading, crafts', clothingWishlist: ['Winter Coat', 'Leggings'], giftTypes: ['Books', 'Craft Kits'] }),
        kid({ name: 'Zoe', age: 6, shirtSize: '6', pantsSize: '6', shoeSize: '1', favoriteColor: 'Teal', hobbies: 'Puzzles', clothingWishlist: ['Pajamas', 'Boots'], giftTypes: ['Puzzles', 'Board Games'] }),
      ],
    },
    {
      status: 'Available', createdDaysAgo: 5, approved: false, city: 'Ferndale', views: 4, claimStarts: 0,
      story: 'My daughter is deaf and loves anything tactile and bright.',
      kids: [kid({ name: 'Nia', age: 7, shirtSize: '8', pantsSize: '8', shoeSize: '2', favoriteColor: 'Orange', hobbies: 'Art, swimming', clothingWishlist: ['Winter Coat', 'Jeans', 'Socks'], giftTypes: ['Art Supplies', 'Craft Kits'] })],
    },
    {
      status: 'Claimed', createdDaysAgo: 25, approved: true, city: 'Detroit', views: 40, claimStarts: 2,
      story: 'Two little boys who share a room and a love of dinosaurs.',
      kids: [
        kid({ name: 'Caleb', age: 4, gender: 'Boy', clothingCategory: 'Toddler', shirtSize: '4T', pantsSize: '4T', shoeCategory: 'Toddler', shoeSize: '10', favoriteColor: 'Green', hobbies: 'Dinosaurs', clothingWishlist: ['Winter Coat', 'Pajamas'], giftTypes: ['Toys / Dolls', 'Books'] }),
        kid({ name: 'Micah', age: 6, gender: 'Boy', shirtSize: '7', pantsSize: '7', shoeSize: '13', favoriteColor: 'Blue', hobbies: 'Dinosaurs, bikes', clothingWishlist: ['Boots', 'Hoodies'], giftTypes: ['Building Sets / LEGO'] }),
      ],
    },
    {
      status: 'Claimed', createdDaysAgo: 18, approved: true, city: 'Royal Oak', views: 22, claimStarts: 1,
      story: '',
      kids: [kid({ name: 'Sophia', age: 16, clothingCategory: "Women's", shirtSize: 'M', pantsSize: '8', shoeCategory: "Women's", shoeSize: '8', favoriteColor: 'Gold', hobbies: 'Photography', clothingWishlist: ['Winter Coat', 'Jeans'], giftTypes: ['Gift Card to a Store', 'Art Supplies'] })],
    },
    {
      status: 'Fulfilled', createdDaysAgo: 40, approved: true, city: 'Detroit', views: 55, claimStarts: 3,
      story: 'Thank you for seeing us.',
      kids: [kid({ name: 'Amara', age: 10, shirtSize: '12', pantsSize: '12', shoeSize: '5', favoriteColor: 'Purple', hobbies: 'Soccer', clothingWishlist: ['Winter Coat'], giftTypes: ['Sports Equipment'] })],
    },
    {
      status: 'Submitted', createdDaysAgo: 1, approved: false, city: 'Detroit', views: 0, claimStarts: 0,
      story: 'We just got back on our feet after a fire.',
      kids: [
        kid({ name: 'Leah', age: 2, clothingCategory: 'Toddler', shirtSize: '2T', pantsSize: '2T', shoeCategory: 'Toddler', shoeSize: '6', favoriteColor: 'Pink', clothingWishlist: ['Pajamas', 'Winter Coat'], giftTypes: ['Toys / Dolls'] }),
        kid({ name: 'Andre', age: 14, gender: 'Boy', clothingCategory: "Men's", shirtSize: 'M', pantsSize: '30', shoeCategory: "Men's", shoeSize: '10', favoriteColor: 'Black', hobbies: 'Music production', clothingWishlist: ['Winter Coat', 'Shoes / Sneakers'], giftTypes: ['Music Items', 'Gift Card to a Store'] }),
      ],
    },
  ];

  const sponsorsSeed = [
    { name: 'Danielle Carter', email: 'danielle@example.com', phone: '', organization: '', preferredContact: 'Email' as const, notes: '' },
    { name: 'Greater Grace Youth Group', email: 'youth@example.org', phone: '', organization: 'Greater Grace Temple', preferredContact: 'Email' as const, notes: '' },
    { name: 'Marcus & Tina Lee', email: 'lee.family@example.com', phone: '', organization: '', preferredContact: 'Text' as const, notes: '' },
  ];
  const sponsors = [];
  for (const s of sponsorsSeed) sponsors.push(await store.createSponsor(s));

  let seq = 1;
  let claimedIdx = 0;
  for (const h of households) {
    const code = familyCode(season, seq++);
    const createdAt = daysAgo(h.createdDaysAgo);
    const fam = await store.createFamily({
      familyId: code, season, status: h.status, slug: shortId(), photoUrl: '', photoApproved: false, raised: h.raised ?? 0, goal: 150 * h.kids.length, nickname: deriveNickname(h.kids.map((k, i) => ({ ...k, id: '', familyId: '', sortOrder: i })), code),
      guardianName: 'Demo Guardian', phone: '313-555-0100', email: '', preferredContact: 'Text', address: '100 Demo St', city: h.city, state: 'MI', zip: '48201',
      transportation: 'Yes', familyStory: h.story, storyApproved: h.approved && !!h.story, eligibilityConfirmed: true, notes: '', adminNotes: '', views: h.views,
      claimStarts: h.claimStarts, approvedAt: h.status === 'Submitted' ? null : daysAgo(h.createdDaysAgo - 1), fulfilledAt: h.status === 'Fulfilled' ? daysAgo(3) : null,
      children: h.kids.map((k, i) => ({ ...k, sortOrder: i })),
    });
    await store.updateFamily(fam.id, { createdAt } as any);
    for (let v = 0; v < Math.min(h.views, 12); v++) {
      await store.logActivity({ type: 'family_view', channel: 'web', familyId: fam.id, sponsorshipId: null, subject: 'Viewed', body: '', meta: {}, occurredAt: daysAgo(Math.random() * h.createdDaysAgo) });
    }
    if (h.status === 'Claimed' || h.status === 'Fulfilled') {
      const sp = sponsors[claimedIdx++ % sponsors.length];
      const claimedAt = daysAgo(h.status === 'Fulfilled' ? 20 : claimedIdx === 1 ? 9 : 2);
      const ss = await store.createSponsorship({
        sponsorshipId: `SP-${season}-${String(claimedIdx).padStart(3, '0')}`, familyId: fam.id, sponsorId: sp.id, token: token(), claimedAt,
        status: h.status === 'Fulfilled' ? 'Delivered' : claimedIdx === 1 ? 'Claimed' : 'Purchased',
        shoppingAt: claimedIdx === 1 ? null : daysAgo(3), purchasedAt: claimedIdx === 1 ? null : daysAgo(1), wrappedAt: h.status === 'Fulfilled' ? daysAgo(6) : null, droppedOffAt: h.status === 'Fulfilled' ? daysAgo(5) : null,
        deliveredAt: h.status === 'Fulfilled' ? daysAgo(3) : null, releasedAt: null, nextFollowUpAt: h.status === 'Fulfilled' ? null : claimedIdx === 1 ? daysAgo(0.5) : daysAgo(-3),
        lastNudgedAt: claimedIdx === 1 ? daysAgo(4) : daysAgo(2), lastResponseAt: claimedIdx === 1 ? null : daysAgo(1), followUpCount: claimedIdx === 1 ? 2 : 1,
        flagged: false, flagReason: '', releaseReason: '', sponsorNote: '', adminNotes: '',
      });
      await store.logActivity({ type: 'claim_complete', channel: 'web', familyId: fam.id, sponsorshipId: ss.id, subject: `${sp.name} claimed ${code}`, body: '', meta: {}, occurredAt: claimedAt });
      await store.logActivity({ type: 'message_sent', channel: 'email', familyId: fam.id, sponsorshipId: ss.id, subject: 'Thank you for claiming a family', body: '', meta: { kind: 'claim_confirmation' }, occurredAt: claimedAt });
      if (claimedIdx === 1) {
        await store.logActivity({ type: 'message_sent', channel: 'email', familyId: fam.id, sponsorshipId: ss.id, subject: 'Quick check-in: are you still in?', body: '', meta: { kind: 'confirm_nudge' }, occurredAt: daysAgo(4) });
      } else {
        await store.logActivity({ type: 'sponsor_response', channel: 'web', familyId: fam.id, sponsorshipId: ss.id, subject: 'Sponsor marked: Gifts purchased', body: '', meta: {}, occurredAt: daysAgo(1) });
      }
    }
  }
  for (let i = 0; i < 60; i++) {
    await store.logActivity({ type: 'catalog_view', channel: 'web', familyId: null, sponsorshipId: null, subject: '', body: '', meta: {}, occurredAt: daysAgo(Math.random() * 30) });
  }
  await store.updateSettings({ season });
  console.log(`[seed] demo data loaded at ${nowIso()}`);
}
