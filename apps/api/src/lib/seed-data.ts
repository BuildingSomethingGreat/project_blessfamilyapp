import type { NewChild } from '../store/types.ts';

/**
 * Realistic (fictional) test households for the Detroit area. Used by the memory
 * store seed and by `pnpm seed:airtable --demo`. Guardian names, phones and
 * addresses are invented; keep them obviously non-real (555 numbers).
 */
export type SeedStatus = 'Available' | 'Claimed' | 'Fulfilled' | 'Submitted' | 'Needs Info';
export interface SeedHousehold {
  status: SeedStatus;
  createdDaysAgo: number;
  city: string;
  guardian: string;
  phone: string;
  email: string;
  preferredContact: 'Text' | 'Call' | 'Email';
  address: string;
  zip: string;
  transportation: 'Yes' | 'No';
  story: string;
  storyApproved: boolean;
  notes?: string;
  views: number;
  claimStarts: number;
  raised?: number;
  kids: NewChild[];
}

const kid = (o: Partial<NewChild> & { name: string; age: number }): NewChild => ({
  gender: 'Girl', clothingCategory: 'Youth / Kids', shirtSize: '10', pantsSize: '10', shoeCategory: 'Youth / Kids', shoeSize: '3', sizeNotes: '',
  favoriteColor: 'Blue', hobbies: '', clothingWishlist: [], otherClothing: '', giftTypes: [], specificGifts: '', sortOrder: 0, ...o,
});

export const SEED_HOUSEHOLDS: SeedHousehold[] = [
  {
    status: 'Available', createdDaysAgo: 24, city: 'Detroit', guardian: 'Tasha Reynolds', phone: '(313) 555-0142', email: 'tasha.r@example.com', preferredContact: 'Text', address: '4120 Tireman Ave', zip: '48204', transportation: 'Yes', views: 52, claimStarts: 3, raised: 120, storyApproved: true,
    story: "I'm a single mom of three and we moved twice this year. The kids have been so brave about it. Jordan draws every single day and Maya wants to be a vet. A warm coat for each of them would mean the world.",
    kids: [
      kid({ name: 'Jordan Reynolds', age: 8, gender: 'Boy', shirtSize: '10', pantsSize: '10', shoeSize: '3', favoriteColor: 'Purple', hobbies: 'Drawing, comics', clothingWishlist: ['Winter Coat', 'Hoodies', 'Jeans'], giftTypes: ['Art Supplies', 'Books'], specificGifts: 'Sketchbook and markers' }),
      kid({ name: 'Maya Reynolds', age: 5, clothingCategory: 'Toddler', shirtSize: '5T', pantsSize: '5T', shoeCategory: 'Toddler', shoeSize: '11', favoriteColor: 'Pink', hobbies: 'Animals', clothingWishlist: ['Winter Coat', 'Pajamas', 'Boots'], giftTypes: ['Toys / Dolls', 'Puzzles'], specificGifts: 'Anything with animals' }),
      kid({ name: 'Eli Reynolds', age: 1, gender: 'Boy', clothingCategory: 'Baby / Infant', shirtSize: '12–18 Months', pantsSize: '12–18 Months', shoeCategory: 'Baby / Infant', shoeSize: '4', favoriteColor: 'Yellow', hobbies: 'Stacking everything', clothingWishlist: ['Pajamas', 'Socks'], giftTypes: ['Educational Games'], specificGifts: 'Stacking toys' }),
    ],
  },
  {
    status: 'Available', createdDaysAgo: 16, city: 'Southfield', guardian: 'Loretta Mitchell', phone: '(248) 555-0190', email: '', preferredContact: 'Call', address: '26500 Evergreen Rd', zip: '48076', transportation: 'No', views: 33, claimStarts: 1, storyApproved: true,
    story: 'Grandma raising two grandkids. Both are on the honor roll and both have outgrown everything since last winter.',
    kids: [
      kid({ name: 'Destiny Mitchell', age: 13, clothingCategory: "Women's", shirtSize: 'S', pantsSize: '4', shoeCategory: "Women's", shoeSize: '7', favoriteColor: 'Black', hobbies: 'Volleyball, music', clothingWishlist: ['Winter Coat', 'Leggings', 'Sweatshirts'], giftTypes: ['Sports Equipment', 'Music Items', 'Gift Card to a Store'], specificGifts: 'Volleyball knee pads, earbuds' }),
      kid({ name: 'Marcus Mitchell', age: 11, gender: 'Boy', shirtSize: '14', pantsSize: '14', shoeSize: '6', favoriteColor: 'Green', hobbies: 'Basketball, LEGO', clothingWishlist: ['Jacket', 'Shoes / Sneakers', 'Socks'], giftTypes: ['Building Sets / LEGO', 'Sports Equipment'], specificGifts: 'Indoor basketball' }),
    ],
  },
  {
    status: 'Available', createdDaysAgo: 10, city: 'Detroit', guardian: 'Monique Alston', phone: '(313) 555-0177', email: 'monique.a@example.com', preferredContact: 'Text', address: '19844 Greenfield Rd', zip: '48235', transportation: 'Yes', views: 14, claimStarts: 0, storyApproved: false,
    story: 'Aaliyah dances through the whole apartment. She is tall for three and grows out of shoes every few months.',
    kids: [kid({ name: 'Aaliyah Alston', age: 3, clothingCategory: 'Toddler', shirtSize: '4T', pantsSize: '3T', shoeCategory: 'Toddler', shoeSize: '9', favoriteColor: 'Rainbow', hobbies: 'Dancing, singing', clothingWishlist: ['Dresses', 'Winter Coat', 'Gloves', 'Hat'], giftTypes: ['Toys / Dolls', 'Music Items'], sizeNotes: 'Tall for her age, 4T tops fit best' })],
  },
  {
    status: 'Available', createdDaysAgo: 31, city: 'Oak Park', guardian: 'Darnell & Kia Washington', phone: '(248) 555-0133', email: 'kia.w@example.com', preferredContact: 'Email', address: '13900 Oak Park Blvd', zip: '48237', transportation: 'Yes', views: 71, claimStarts: 4, raised: 275, storyApproved: true,
    story: "Four kids, one bathroom, a lot of laughter. Dad works nights at the plant. We'd be grateful for anything, but the boys desperately need boots.",
    kids: [
      kid({ name: 'Isaiah Washington', age: 15, gender: 'Boy', clothingCategory: "Men's", shirtSize: 'L', pantsSize: '32', shoeCategory: "Men's", shoeSize: '11', favoriteColor: 'Red', hobbies: 'Football, gaming', clothingWishlist: ['Boots', 'Winter Coat', 'Sweatpants'], giftTypes: ['Video Games', 'Gift Card to a Store'], specificGifts: 'Gift card for games' }),
      kid({ name: 'Noah Washington', age: 12, gender: 'Boy', shirtSize: '16', pantsSize: '16', shoeSize: '7', favoriteColor: 'Blue', hobbies: 'Science, Minecraft', clothingWishlist: ['Boots', 'Hoodies'], giftTypes: ['Building Sets / LEGO', 'Educational Games'], specificGifts: 'Science kit' }),
      kid({ name: 'Grace Washington', age: 9, shirtSize: '10', pantsSize: '10', shoeSize: '4', favoriteColor: 'Lavender', hobbies: 'Reading, crafts', clothingWishlist: ['Winter Coat', 'Leggings'], giftTypes: ['Books', 'Craft Kits'], specificGifts: 'Chapter books, friendship bracelet kit' }),
      kid({ name: 'Zoe Washington', age: 6, shirtSize: '6', pantsSize: '6', shoeSize: '1', favoriteColor: 'Teal', hobbies: 'Puzzles', clothingWishlist: ['Pajamas', 'Boots'], giftTypes: ['Puzzles', 'Board Games'] }),
    ],
  },
  {
    status: 'Available', createdDaysAgo: 6, city: 'Ferndale', guardian: 'Renee Patterson', phone: '(248) 555-0108', email: 'renee.p@example.com', preferredContact: 'Text', address: '620 Pinecrest Dr', zip: '48220', transportation: 'Yes', views: 6, claimStarts: 0, storyApproved: true,
    story: 'My daughter is deaf and loves anything tactile and bright. Art supplies are her whole world.',
    kids: [kid({ name: 'Nia Patterson', age: 7, shirtSize: '8', pantsSize: '8', shoeSize: '2', favoriteColor: 'Orange', hobbies: 'Art, swimming', clothingWishlist: ['Winter Coat', 'Jeans', 'Socks'], giftTypes: ['Art Supplies', 'Craft Kits'], specificGifts: 'Finger paints, clay' })],
  },
  {
    status: 'Available', createdDaysAgo: 19, city: 'Highland Park', guardian: 'Carla Jennings', phone: '(313) 555-0163', email: '', preferredContact: 'Text', address: '55 Ferris St', zip: '48203', transportation: 'No', views: 27, claimStarts: 2, storyApproved: true,
    story: 'Twins! Two very different girls who share everything except opinions. We lost our car in the spring so delivery would help a lot.',
    kids: [
      kid({ name: 'Imani Jennings', age: 10, shirtSize: '12', pantsSize: '12', shoeSize: '4', favoriteColor: 'Purple', hobbies: 'Soccer, YouTube science videos', clothingWishlist: ['Winter Coat', 'Sweatpants', 'Shoes / Sneakers'], giftTypes: ['Sports Equipment', 'Educational Games'], specificGifts: 'Soccer ball, microscope kit' }),
      kid({ name: 'Amara Jennings', age: 10, shirtSize: '10', pantsSize: '12', shoeSize: '3', favoriteColor: 'Gold', hobbies: 'Baking, journaling', clothingWishlist: ['Winter Coat', 'Dresses', 'Boots'], giftTypes: ['Craft Kits', 'Books'], specificGifts: 'Kids baking set, journal with a lock' }),
    ],
  },
  {
    status: 'Available', createdDaysAgo: 3, city: 'Dearborn', guardian: 'Hana Saleh', phone: '(313) 555-0121', email: 'hana.s@example.com', preferredContact: 'Email', address: '7340 Chase Rd', zip: '48126', transportation: 'Yes', views: 9, claimStarts: 1, storyApproved: true,
    story: 'We arrived last year and the kids are thriving in school. Yusuf reads anything with maps; Layla wants to be an engineer like her late father.',
    kids: [
      kid({ name: 'Yusuf Saleh', age: 9, gender: 'Boy', shirtSize: '10', pantsSize: '10', shoeSize: '3', favoriteColor: 'Green', hobbies: 'Maps, chess', clothingWishlist: ['Winter Coat', 'Long-Sleeve Shirts', 'Gloves'], giftTypes: ['Books', 'Board Games'], specificGifts: 'Atlas, chess set' }),
      kid({ name: 'Layla Saleh', age: 12, shirtSize: '14', pantsSize: '14', shoeSize: '5', favoriteColor: 'Teal', hobbies: 'Building things, math', clothingWishlist: ['Winter Coat', 'Jeans', 'Scarf'], giftTypes: ['Building Sets / LEGO', 'Educational Games'], specificGifts: 'LEGO Technic set' }),
      kid({ name: 'Adam Saleh', age: 2, gender: 'Boy', clothingCategory: 'Toddler', shirtSize: '3T', pantsSize: '2T', shoeCategory: 'Toddler', shoeSize: '7', favoriteColor: 'Red', hobbies: 'Trucks', clothingWishlist: ['Pajamas', 'Winter Coat', 'Hat'], giftTypes: ['Toys / Dolls'], specificGifts: 'Toy trucks' }),
    ],
  },
  {
    status: 'Available', createdDaysAgo: 13, city: 'Redford', guardian: 'Brian Kowalski', phone: '(313) 555-0188', email: 'bkowalski@example.com', preferredContact: 'Call', address: '18311 Beech Daly Rd', zip: '48240', transportation: 'Yes', views: 18, claimStarts: 1, storyApproved: false,
    story: 'Single dad, two boys, one very old minivan. The boys are into anything with wheels.',
    kids: [
      kid({ name: 'Tyler Kowalski', age: 14, gender: 'Boy', clothingCategory: "Men's", shirtSize: 'M', pantsSize: '30', shoeCategory: "Men's", shoeSize: '10', favoriteColor: 'Black', hobbies: 'Skateboarding, BMX', clothingWishlist: ['Winter Coat', 'Hoodies', 'Shoes / Sneakers'], giftTypes: ['Sports Equipment', 'Gift Card to a Store'], specificGifts: 'Skate shoes, helmet' }),
      kid({ name: 'Mason Kowalski', age: 6, gender: 'Boy', shirtSize: '7', pantsSize: '6', shoeSize: '13', favoriteColor: 'Blue', hobbies: 'Hot Wheels', clothingWishlist: ['Winter Coat', 'Pajamas', 'Boots'], giftTypes: ['Toys / Dolls', 'Building Sets / LEGO'], specificGifts: 'Hot Wheels track' }),
    ],
  },
  {
    status: 'Claimed', createdDaysAgo: 26, city: 'Detroit', guardian: 'Angela Turner', phone: '(313) 555-0151', email: 'angela.t@example.com', preferredContact: 'Text', address: '9120 Mack Ave', zip: '48214', transportation: 'No', views: 44, claimStarts: 2, storyApproved: true,
    story: 'Two little boys who share a room and a love of dinosaurs. Caleb roars at the mailman.',
    kids: [
      kid({ name: 'Caleb Turner', age: 4, gender: 'Boy', clothingCategory: 'Toddler', shirtSize: '4T', pantsSize: '4T', shoeCategory: 'Toddler', shoeSize: '10', favoriteColor: 'Green', hobbies: 'Dinosaurs', clothingWishlist: ['Winter Coat', 'Pajamas'], giftTypes: ['Toys / Dolls', 'Books'], specificGifts: 'Dinosaur figures' }),
      kid({ name: 'Micah Turner', age: 6, gender: 'Boy', shirtSize: '7', pantsSize: '7', shoeSize: '13', favoriteColor: 'Blue', hobbies: 'Dinosaurs, bikes', clothingWishlist: ['Boots', 'Hoodies'], giftTypes: ['Building Sets / LEGO'], specificGifts: 'Dinosaur LEGO' }),
    ],
  },
  {
    status: 'Claimed', createdDaysAgo: 20, city: 'Royal Oak', guardian: 'Denise Holloway', phone: '(248) 555-0160', email: 'denise.h@example.com', preferredContact: 'Email', address: '3200 Crooks Rd', zip: '48073', transportation: 'Yes', views: 25, claimStarts: 1, raised: 50, storyApproved: false,
    story: 'Sophia is a junior who photographs everything. She has been using a cracked phone camera for two years.',
    kids: [kid({ name: 'Sophia Holloway', age: 16, clothingCategory: "Women's", shirtSize: 'M', pantsSize: '8', shoeCategory: "Women's", shoeSize: '8', favoriteColor: 'Gold', hobbies: 'Photography', clothingWishlist: ['Winter Coat', 'Jeans'], giftTypes: ['Gift Card to a Store', 'Art Supplies'], specificGifts: 'Gift card toward a used camera' })],
  },
  {
    status: 'Claimed', createdDaysAgo: 22, city: 'Warren', guardian: 'Patrice Dawson', phone: '(586) 555-0115', email: 'patrice.d@example.com', preferredContact: 'Text', address: '27000 Ryan Rd', zip: '48092', transportation: 'Yes', views: 30, claimStarts: 2, storyApproved: true,
    story: 'Three kids, three very different personalities. Jaylen is the quiet builder, Kennedy runs the house, and baby Zuri just started walking.',
    kids: [
      kid({ name: 'Jaylen Dawson', age: 11, gender: 'Boy', shirtSize: '14', pantsSize: '12', shoeSize: '5', favoriteColor: 'Blue', hobbies: 'Building, coding games', clothingWishlist: ['Winter Coat', 'Jeans', 'Shoes / Sneakers'], giftTypes: ['Building Sets / LEGO', 'Educational Games'] }),
      kid({ name: 'Kennedy Dawson', age: 8, shirtSize: '8', pantsSize: '8', shoeSize: '2', favoriteColor: 'Pink', hobbies: 'Cheer, drawing', clothingWishlist: ['Winter Coat', 'Leggings', 'Boots'], giftTypes: ['Art Supplies', 'Toys / Dolls'] }),
      kid({ name: 'Zuri Dawson', age: 1, clothingCategory: 'Baby / Infant', shirtSize: '18–24 Months', pantsSize: '18–24 Months', shoeCategory: 'Baby / Infant', shoeSize: '4', favoriteColor: 'Yellow', hobbies: 'Walking into everything', clothingWishlist: ['Pajamas', 'Socks', 'Winter Coat'], giftTypes: ['Educational Games', 'Books'], specificGifts: 'Board books' }),
    ],
  },
  {
    status: 'Fulfilled', createdDaysAgo: 42, city: 'Detroit', guardian: 'Kim Dubois', phone: '(313) 555-0199', email: 'kim.d@example.com', preferredContact: 'Text', address: '14230 Woodward Ave', zip: '48203', transportation: 'Yes', views: 58, claimStarts: 3, storyApproved: true,
    story: 'Thank you for seeing us. Amara practices soccer in the hallway every night.',
    kids: [kid({ name: 'Amara Dubois', age: 10, shirtSize: '12', pantsSize: '12', shoeSize: '5', favoriteColor: 'Purple', hobbies: 'Soccer', clothingWishlist: ['Winter Coat'], giftTypes: ['Sports Equipment'], specificGifts: 'Soccer cleats' })],
  },
  {
    status: 'Fulfilled', createdDaysAgo: 39, city: 'Inkster', guardian: 'Gloria Bennett', phone: '(313) 555-0170', email: '', preferredContact: 'Call', address: '2200 Inkster Rd', zip: '48141', transportation: 'No', views: 36, claimStarts: 2, storyApproved: true,
    story: 'Raising my nephew since his mom passed. He is sweet, quiet, and obsessed with trains.',
    kids: [kid({ name: 'Elijah Bennett', age: 5, gender: 'Boy', clothingCategory: 'Toddler', shirtSize: '5T', pantsSize: '5T', shoeCategory: 'Toddler', shoeSize: '12', favoriteColor: 'Blue', hobbies: 'Trains', clothingWishlist: ['Winter Coat', 'Pajamas', 'Boots'], giftTypes: ['Toys / Dolls', 'Books'], specificGifts: 'Wooden train set' })],
  },
  {
    status: 'Submitted', createdDaysAgo: 1, city: 'Detroit', guardian: 'Marcus Bell', phone: '(313) 555-0115', email: 'mbell@example.com', preferredContact: 'Text', address: '5900 Rosa Parks Blvd', zip: '48208', transportation: 'Yes', views: 0, claimStarts: 0, storyApproved: false,
    story: 'We just got back on our feet after a fire. Andre makes beats on a cracked phone and Leah sings along to all of them.',
    kids: [
      kid({ name: 'Leah Bell', age: 2, clothingCategory: 'Toddler', shirtSize: '2T', pantsSize: '2T', shoeCategory: 'Toddler', shoeSize: '6', favoriteColor: 'Pink', hobbies: 'Singing', clothingWishlist: ['Pajamas', 'Winter Coat'], giftTypes: ['Toys / Dolls', 'Music Items'] }),
      kid({ name: 'Andre Bell', age: 14, gender: 'Boy', clothingCategory: "Men's", shirtSize: 'M', pantsSize: '30', shoeCategory: "Men's", shoeSize: '10', favoriteColor: 'Black', hobbies: 'Music production', clothingWishlist: ['Winter Coat', 'Shoes / Sneakers'], giftTypes: ['Music Items', 'Gift Card to a Store'], specificGifts: 'Headphones' }),
    ],
  },
  {
    status: 'Submitted', createdDaysAgo: 0, city: 'Hazel Park', guardian: 'Jessica Nowak', phone: '(248) 555-0144', email: 'jess.nowak@example.com', preferredContact: 'Email', address: '23100 John R Rd', zip: '48030', transportation: 'Yes', views: 0, claimStarts: 0, storyApproved: false,
    story: '',
    notes: 'Olivia has a nut allergy, please no food gifts.',
    kids: [kid({ name: 'Olivia Nowak', age: 7, shirtSize: '8', pantsSize: '7', shoeSize: '1', favoriteColor: 'Lavender', hobbies: 'Horses, reading', clothingWishlist: ['Winter Coat', 'Boots', 'Underwear', 'Socks'], giftTypes: ['Books', 'Toys / Dolls'], specificGifts: 'Horse figurines' })],
  },
  {
    status: 'Needs Info', createdDaysAgo: 4, city: 'Detroit', guardian: 'Terrence Gaines', phone: '(313) 555-0127', email: '', preferredContact: 'Text', address: '', zip: '48219', transportation: 'No', views: 0, claimStarts: 0, storyApproved: false,
    story: '',
    notes: 'Address missing on the application; staff left a voicemail 10/21.',
    kids: [kid({ name: 'Kameron Gaines', age: 9, gender: 'Boy', shirtSize: '10', pantsSize: '10', shoeSize: 'Other / Not Sure', sizeNotes: 'Between a 3 and 4, wide feet', favoriteColor: 'Red', hobbies: 'Football', clothingWishlist: ['Winter Coat', 'Shoes / Sneakers'], giftTypes: ['Sports Equipment'] })],
  },
];

export const SEED_SPONSORS = [
  { name: 'Danielle Carter', email: 'danielle@example.com', phone: '', organization: '', preferredContact: 'Email' as const, notes: '' },
  { name: 'Greater Grace Youth Group', email: 'youth@example.org', phone: '', organization: 'Greater Grace Temple', preferredContact: 'Email' as const, notes: 'Group of 12 teens; wants 2 families next year' },
  { name: 'Marcus & Tina Lee', email: 'lee.family@example.com', phone: '(313) 555-0199', organization: '', preferredContact: 'Text' as const, notes: '' },
  { name: 'Rocket Mortgage Team 4B', email: 'team4b@example.com', phone: '', organization: 'Rocket Mortgage', preferredContact: 'Email' as const, notes: 'Corporate team; invoice-free' },
  { name: 'Priya Natarajan', email: 'priya.n@example.com', phone: '(248) 555-0101', organization: '', preferredContact: 'Text' as const, notes: '' },
];

/** Which seeded sponsorship goes with which claimed/fulfilled household (by index in SEED_HOUSEHOLDS). */
export const SEED_SPONSORSHIPS: { householdIdx: number; sponsorIdx: number; status: 'Claimed' | 'Shopping' | 'Purchased' | 'Wrapped' | 'Dropped Off' | 'Delivered'; claimedDaysAgo: number; lastResponseDaysAgo: number | null; lastNudgedDaysAgo: number | null; followUpCount: number; flagged?: boolean; note?: string }[] = [
  { householdIdx: 8, sponsorIdx: 0, status: 'Claimed', claimedDaysAgo: 9, lastResponseDaysAgo: null, lastNudgedDaysAgo: 4, followUpCount: 2, flagged: true },
  { householdIdx: 9, sponsorIdx: 1, status: 'Purchased', claimedDaysAgo: 7, lastResponseDaysAgo: 1, lastNudgedDaysAgo: 2, followUpCount: 0, note: 'Picked up a camera gift card from Best Buy' },
  { householdIdx: 10, sponsorIdx: 3, status: 'Shopping', claimedDaysAgo: 5, lastResponseDaysAgo: 2, lastNudgedDaysAgo: 3, followUpCount: 0 },
  { householdIdx: 11, sponsorIdx: 2, status: 'Delivered', claimedDaysAgo: 20, lastResponseDaysAgo: 5, lastNudgedDaysAgo: 6, followUpCount: 0 },
  { householdIdx: 12, sponsorIdx: 4, status: 'Delivered', claimedDaysAgo: 18, lastResponseDaysAgo: 4, lastNudgedDaysAgo: 8, followUpCount: 0, note: 'Added a train table, hope that is okay!' },
];
