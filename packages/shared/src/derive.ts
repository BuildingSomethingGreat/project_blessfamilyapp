import type { Child, Family, PublicFamily, PublicChild } from './types.ts';

export const COLOR_MAP: Record<string, string> = {
  purple: '#7c5cff', pink: '#ff7eb6', yellow: '#f5c542', black: '#1b1a17', green: '#2fa36b', rainbow: '#c17aff', red: '#e34948', blue: '#2a78d6',
  lavender: '#b39ddb', teal: '#2aa8a8', orange: '#f08a3c', gold: '#e8b04b', white: '#f4f4f4', gray: '#9a9a9a', grey: '#9a9a9a', silver: '#b8b8c0',
  brown: '#8a5a3c', navy: '#1f3a73', turquoise: '#30c4c4', lime: '#9ccc27', magenta: '#d5338f', aqua: '#2aa8a8', violet: '#7c5cff', maroon: '#7a1f2b',
  mint: '#8fd3b6', peach: '#f7b48c', coral: '#f26b5b', cyan: '#19b5d6', indigo: '#3f51b5', tan: '#d2b48c', beige: '#e2cfae', burgundy: '#7a1f2b', cream: '#f4e7c3',
};
/** CSS background for a favorite-color swatch (Rainbow gets a gradient). */
export function colorSwatch(name: string): string {
  if (name.toLowerCase().trim() === 'rainbow') return 'linear-gradient(90deg,#ff5e5e,#ffb84d,#7ad67a,#5aa9ff,#c17aff)';
  return colorToHex(name) ?? '#9a948a';
}
/** Card art: a two-stop gradient from the first two kids' favorite colors (purple/lavender fallback). */
export function familyArt(colors: string[]): string {
  const a = colors[0] ?? '#6c22dd';
  const b = colors[1] ?? '#c9b8ff';
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

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
  if (children.some((c) => c.clothingWishlist.includes('Boots'))) tags.add('Needs boots');
  if (children.some((c) => c.clothingWishlist.includes('Shoes / Sneakers'))) tags.add('Needs shoes');
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
  const adj = ['Bright', 'Merry', 'Kind', 'Curious', 'Cozy', 'Hopeful', 'Golden', 'Brave'][hash % 8];
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
  const daysWaiting = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86_400_000));
  const n = kids.length;
  return {
    familyId: f.familyId,
    slug: f.slug,
    nickname: f.nickname || deriveNickname(kids, f.familyId),
    city: f.city,
    status: f.status,
    story: f.storyApproved ? f.familyStory : '',
    photoUrl: f.photoApproved ? f.photoUrl : '',
    raised: f.raised ?? 0,
    goal: f.goal || n * 150,
    childCount: n,
    ageRange: [Math.min(...ages), Math.max(...ages)],
    colors: colors.length ? colors : ['#eb6834'],
    tags: deriveTags(kids),
    daysWaiting,
    waitLabel: daysWaiting === 0 ? 'New today' : `Waiting ${daysWaiting} day${daysWaiting === 1 ? '' : 's'}`,
    kidLine: n === 1 ? '1 child' : `${n} kids`,
    kidNames: kids.map((k) => `${firstName(k.name)} (${k.age})`).join(', '),
    children: kids.map(toPublicChild),
  };
}
