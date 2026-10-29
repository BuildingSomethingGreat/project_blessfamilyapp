import type { Child, Family, PublicFamily, PublicChild } from './types.ts';
import { GOAL_PER_CHILD } from './sizes.ts';

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

/** Age groups used by the catalog filters and card chips. Ranges are inclusive. */
export const AGE_GROUPS = [
  { key: 'little', label: 'Babies & toddlers', range: '0–3', min: 0, max: 3 },
  { key: 'kids', label: 'Kids', range: '4–12', min: 4, max: 12 },
  { key: 'teens', label: 'Teens', range: '13–17', min: 13, max: 17 },
] as const;
export type AgeGroupKey = (typeof AGE_GROUPS)[number]['key'];

/** Clothing needs the catalog can filter on, keyed to the wishlist option that signals them. */
export const NEED_FILTERS = [
  { key: 'coat', label: 'Winter coat', tag: 'Needs a winter coat', item: 'Winter Coat' },
  { key: 'boots', label: 'Boots', tag: 'Needs boots', item: 'Boots' },
  { key: 'shoes', label: 'Shoes', tag: 'Needs shoes', item: 'Shoes / Sneakers' },
] as const;
export type NeedKey = (typeof NEED_FILTERS)[number]['key'];

export function ageBand(age: number): string {
  if (age <= 3) return 'Baby / toddler';
  if (age <= 12) return 'Kid';
  return 'Teen';
}

export function deriveTags(children: Child[]): string[] {
  const tags = new Set<string>();
  const n = children.length;
  if (n === 1) tags.add('1 child');
  else if (n <= 3) tags.add(`${n} kids`);
  else tags.add('Big family');
  const bands = new Set(children.map((c) => ageBand(c.age)));
  if (bands.has('Baby / toddler')) tags.add('Baby or toddler');
  if (bands.has('Teen')) tags.add('Teen');
  for (const n of NEED_FILTERS) if (children.some((c) => (c.clothingWishlist as readonly string[]).includes(n.item))) tags.add(n.tag);
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

const NICK_ADJECTIVES = ['Bright', 'Merry', 'Kind', 'Curious', 'Cozy', 'Hopeful', 'Golden', 'Brave', 'Jolly', 'Joyful', 'Sunny', 'Starry'];
type NickSource = Pick<Child, 'giftTypes' | 'hobbies'>;

/**
 * Friendly, non-identifying display name derived from the kids' interests ("The Merry Builders").
 * `variant` 0 is the default; other values give the alternatives behind the "Shuffle" button.
 */
export function deriveNickname(children: NickSource[], seed: string, variant = 0): string {
  const counts = new Map<string, number>();
  for (const c of children) for (const g of c.giftTypes) counts.set(g, (counts.get(g) ?? 0) + 1);
  const words = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => NICK_WORDS[g]).filter((w): w is string => !!w);
  const hobby = children.map((c) => c.hobbies).find(Boolean)?.split(/[,\s]+/)[0]?.replace(/[^\p{L}]/gu, '');
  if (hobby && hobby.length >= 3) words.push(`${hobby.replace(/^\p{L}/u, (m) => m.toUpperCase())} Family`);
  if (!words.length) words.push('Family');
  const hash = [...seed].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const adjs = variant === 0 ? NICK_ADJECTIVES.slice(0, 8) : NICK_ADJECTIVES; // variant 0 keeps names stable for existing families
  const adj = adjs[(hash + variant * 5) % adjs.length];
  const word = words[variant % words.length];
  return `The ${adj} ${word}`;
}

/**
 * Nicknames are public, so they must not identify the family. Returns a message to show, or null if
 * the nickname is fine. Checks length, characters, the parent's name, the children's last names and
 * long numbers (addresses, phone numbers). Children's first names are already public and are allowed.
 */
export function nicknameProblem(nickname: string, priv: { guardianName?: string; childNames?: string[] } = {}): string | null {
  const n = nickname.trim();
  if (n.length < 3 || n.length > 40) return 'Keep the nickname between 3 and 40 characters.';
  if (!/^[\p{L}\p{N} '’&.,!-]+$/u.test(n)) return 'Use letters, numbers and spaces only.';
  if (/\d{3,}/.test(n)) return 'Please leave out numbers like an address or phone number.';
  const words = new Set(n.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean));
  const parent = (priv.guardianName ?? '').toLowerCase().split(/[^\p{L}]+/u).filter((w) => w.length >= 3);
  const lastNames = (priv.childNames ?? []).flatMap((c) => c.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean).slice(1)).filter((w) => w.length >= 3);
  if ([...parent, ...lastNames].some((w) => words.has(w))) return "Please leave out last names and the parent's name. Holiday Konnectors see this nickname.";
  return null;
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
    photoUrl: f.photoApproved && !f.photoPrivate ? f.photoUrl : '',
    raised: f.raised ?? 0,
    goal: f.goal || n * GOAL_PER_CHILD,
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
