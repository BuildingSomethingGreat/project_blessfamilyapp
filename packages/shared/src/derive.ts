import type { Child, Family, PublicFamily, PublicChild } from './types.ts';

export const COLOR_MAP: Record<string, string> = {
  red: '#e34948', blue: '#2a78d6', green: '#1baf7a', yellow: '#eda100', orange: '#eb6834', purple: '#6250d6',
  pink: '#e87ba4', black: '#2a2a2a', white: '#f2efe8', gray: '#9a9a9a', grey: '#9a9a9a', teal: '#1a9c9c', gold: '#d4a017',
  silver: '#b8b8c0', brown: '#8a5a3c', navy: '#1f3a73', lavender: '#b39ddb', turquoise: '#30c4c4', lime: '#9ccc27',
  magenta: '#d5338f', rainbow: '#eb6834', aqua: '#1baf7a', violet: '#6250d6', maroon: '#7a1f2b', mint: '#8fd3b6', peach: '#f7b48c',
  coral: '#f26b5b', cyan: '#19b5d6', indigo: '#3f51b5', tan: '#d2b48c', beige: '#e2cfae', burgundy: '#7a1f2b', cream: '#f4e7c3',
};

export function colorToHex(name: string): string | null {
  const key = name.toLowerCase().trim();
  if (!key) return null;
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  for (const k of Object.keys(COLOR_MAP)) if (key.includes(k)) return COLOR_MAP[k];
  return null;
}

export function firstName(name: string): string {
  return (name || 'Child').trim().split(/\s+/)[0];
}

export function ageBand(age: number): string {
  if (age < 2) return 'Baby';
  if (age < 5) return 'Little kid';
  if (age < 10) return 'Kid';
  if (age < 13) return 'Tween';
  return 'Teen';
}

export function deriveTags(children: Child[]): string[] {
  const tags = new Set<string>();
  const n = children.length;
  if (n === 1) tags.add('1 child');
  else if (n <= 3) tags.add(`${n} kids`);
  else tags.add('Big family');
  const bands = new Set(children.map((c) => ageBand(c.age)));
  for (const b of ['Baby', 'Little kid', 'Kid', 'Tween', 'Teen']) if (bands.has(b)) tags.add(b === 'Baby' ? 'Babies' : b === 'Little kid' ? 'Little kids' : b + 's');
  if (children.some((c) => c.clothingWishlist.includes('Winter Coat'))) tags.add('Needs winter coats');
  if (children.some((c) => c.clothingWishlist.includes('Boots') || c.clothingWishlist.includes('Shoes / Sneakers'))) tags.add('Needs shoes');
  if (children.some((c) => c.giftTypes.includes('Books'))) tags.add('Readers');
  if (children.some((c) => c.giftTypes.includes('Sports Equipment'))) tags.add('Athletes');
  if (children.some((c) => c.giftTypes.includes('Art Supplies') || c.giftTypes.includes('Craft Kits'))) tags.add('Creatives');
  if (children.some((c) => c.giftTypes.includes('Building Sets / LEGO'))) tags.add('Builders');
  return [...tags];
}

const NICK_WORDS: Record<string, string> = {
  'Building Sets / LEGO': 'Builders', 'Art Supplies': 'Artists', Books: 'Readers', 'Sports Equipment': 'Athletes', 'Board Games': 'Game Night Crew',
  'Music Items': 'Music Makers', Puzzles: 'Puzzlers', 'Craft Kits': 'Makers', 'Video Games': 'Gamers', 'Toys / Dolls': 'Playmakers',
  'Educational Games': 'Explorers',
};

/** Friendly, non-identifying display name derived from the kids' interests. */
export function deriveNickname(children: Child[], seed: string): string {
  const counts = new Map<string, number>();
  for (const c of children) for (const g of c.giftTypes) counts.set(g, (counts.get(g) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).find(([g]) => NICK_WORDS[g]);
  const hobby = children.map((c) => c.hobbies).find(Boolean);
  const word = top ? NICK_WORDS[top[0]] : hobby ? `${hobby.split(/[,\s]+/)[0].replace(/^\w/, (m) => m.toUpperCase())} Family` : 'Family';
  const hash = [...seed].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const adj = ['Bright', 'Sunny', 'Brave', 'Joyful', 'Kind', 'Curious', 'Cozy', 'Merry', 'Hopeful', 'Golden', 'Little', 'Mighty'][hash % 12];
  return `The ${adj} ${word}`;
}

export function toPublicChild(c: Child): PublicChild {
  return {
    name: firstName(c.name), age: c.age, gender: c.gender, clothingCategory: c.clothingCategory, shirtSize: c.shirtSize,
    pantsSize: c.pantsSize, shoeCategory: c.shoeCategory, shoeSize: c.shoeSize, sizeNotes: c.sizeNotes, favoriteColor: c.favoriteColor,
    hobbies: c.hobbies, clothingWishlist: c.clothingWishlist, otherClothing: c.otherClothing, giftTypes: c.giftTypes, specificGifts: c.specificGifts,
  };
}

export function toPublicFamily(f: Family, now = new Date()): PublicFamily {
  const kids = [...f.children].sort((a, b) => a.sortOrder - b.sortOrder);
  const ages = kids.map((k) => k.age);
  const since = f.approvedAt ? new Date(f.approvedAt) : new Date(f.createdAt);
  const colors = kids.map((k) => colorToHex(k.favoriteColor)).filter((x): x is string => !!x);
  return {
    familyId: f.familyId,
    slug: f.slug,
    nickname: f.nickname || deriveNickname(kids, f.familyId),
    city: f.city,
    status: f.status,
    story: f.storyApproved ? f.familyStory : '',
    childCount: kids.length,
    ageRange: [Math.min(...ages), Math.max(...ages)],
    colors: colors.length ? colors : ['#eb6834'],
    tags: deriveTags(kids),
    daysWaiting: Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86_400_000)),
    children: kids.map(toPublicChild),
  };
}
