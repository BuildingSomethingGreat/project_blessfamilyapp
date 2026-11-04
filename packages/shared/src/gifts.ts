import { GIFT_OPTIONS } from './sizes.ts';

export type GiftOption = (typeof GIFT_OPTIONS)[number];

/**
 * Follow-up questions shown after a parent picks "Fun gifts" for a child, so a Holiday Konnector
 * can buy the right thing (which game system, which store for a gift card…). Keep them short.
 *
 * `short` is the stable label used when the answers are written to Airtable ("Video Games · System:
 * Nintendo Switch"), so rename `label` freely but change `short` only with a data migration.
 */
export interface GiftQuestion {
  id: string;
  gift: GiftOption;
  short: string;
  label: string;
  kind: 'multi' | 'single' | 'text';
  options?: readonly string[];
  placeholder?: string;
  required?: boolean;
}

export const GIFT_QUESTIONS: readonly GiftQuestion[] = [
  { id: 'vg_system', gift: 'Video Games', short: 'System', label: 'Which game system?', kind: 'multi', required: true,
    options: ['Nintendo Switch', 'Nintendo Switch 2', 'PlayStation 5', 'PlayStation 4', 'Xbox Series X|S', 'Xbox One', 'PC', 'Tablet / phone', 'No system yet'] },
  { id: 'vg_games', gift: 'Video Games', short: 'Favorites', label: 'Favorite games or kinds of games?', kind: 'text', placeholder: 'Minecraft, Mario Kart, sports games' },
  { id: 'gc_store', gift: 'Gift Card to a Store', short: 'Store', label: 'Which store?', kind: 'text', required: true, placeholder: 'Target, Walmart, Amazon, Roblox' },
  { id: 'toys_kind', gift: 'Toys / Dolls', short: 'Kind', label: 'What kind of toys or dolls?', kind: 'text', placeholder: 'Barbie, action figures, plush, cars' },
  { id: 'lego_theme', gift: 'Building Sets / LEGO', short: 'Themes', label: 'Favorite sets or themes?', kind: 'text', placeholder: 'Star Wars, Friends, City, Minecraft' },
  { id: 'art_kind', gift: 'Art Supplies', short: 'Likes', label: 'What do they like to make?', kind: 'multi',
    options: ['Drawing', 'Painting', 'Coloring', 'Markers & pens', 'Clay', 'Crafts'] },
  { id: 'books_level', gift: 'Books', short: 'Reading level', label: 'Reading level?', kind: 'single',
    options: ['Picture books', 'Early reader', 'Chapter books', 'Middle grade', 'Teen'] },
  { id: 'books_fav', gift: 'Books', short: 'Favorites', label: 'Favorite series or topics?', kind: 'text', placeholder: 'Dog Man, Pokémon, mysteries' },
  { id: 'sport', gift: 'Sports Equipment', short: 'Sport', label: 'Which sport?', kind: 'multi', required: true,
    options: ['Basketball', 'Football', 'Soccer', 'Baseball / softball', 'Volleyball', 'Tennis', 'Skating', 'Gymnastics', 'Track', 'Other'] },
  { id: 'board_fav', gift: 'Board Games', short: 'Favorites', label: 'Any favorites?', kind: 'text', placeholder: 'Uno, Monopoly, Connect 4' },
  { id: 'puzzle_size', gift: 'Puzzles', short: 'Size', label: 'What size?', kind: 'single',
    options: ['Under 100 pieces', '100–300 pieces', '500+ pieces', '3D / brain teasers'] },
  { id: 'edu_subject', gift: 'Educational Games', short: 'Subject', label: 'Favorite subject?', kind: 'multi',
    options: ['Reading', 'Math', 'Science / STEM', 'Coding', 'Geography'] },
  { id: 'music_item', gift: 'Music Items', short: 'Item', label: 'Which instrument or item?', kind: 'text', required: true, placeholder: 'Keyboard, guitar, headphones, karaoke mic' },
  { id: 'craft_kind', gift: 'Craft Kits', short: 'Kind', label: 'What kind of crafts?', kind: 'text', placeholder: 'Bracelets, slime, sewing, model kits' },
  { id: 'other_gift', gift: 'Other', short: 'Gift', label: 'What gift?', kind: 'text', required: true, placeholder: 'Describe it in a few words' },
];

export type GiftDetails = Record<string, string>;

/** The follow-up questions for the gifts a child has selected, in the order the gifts were picked. */
export function giftQuestionsFor(giftTypes: readonly string[]): GiftQuestion[] {
  return giftTypes.flatMap((g) => GIFT_QUESTIONS.filter((q) => q.gift === g));
}

/** Keeps only answers to questions for the selected gifts, trimmed; multi answers stay comma-separated. */
export function cleanGiftDetails(giftTypes: readonly string[], details: GiftDetails | undefined): GiftDetails {
  const out: GiftDetails = {};
  for (const q of giftQuestionsFor(giftTypes)) {
    const v = (details?.[q.id] ?? '').trim();
    if (v) out[q.id] = v.slice(0, 200);
  }
  return out;
}

/** Required follow-ups that are still empty. */
export function missingGiftDetails(giftTypes: readonly string[], details: GiftDetails | undefined): GiftQuestion[] {
  return giftQuestionsFor(giftTypes).filter((q) => q.required && !(details?.[q.id] ?? '').trim());
}

/** Answers as readable lines grouped by gift, e.g. { gift: 'Video Games', parts: ['Nintendo Switch', 'Minecraft'] }. */
export function giftDetailLines(giftTypes: readonly string[], details: GiftDetails | undefined): { gift: string; parts: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const q of giftQuestionsFor(giftTypes)) {
    const v = (details?.[q.id] ?? '').trim();
    if (!v) continue;
    if (!groups.has(q.gift)) groups.set(q.gift, []);
    groups.get(q.gift)!.push(v);
  }
  return [...groups].map(([gift, parts]) => ({ gift, parts }));
}

/** Airtable text form: one "Gift · Short: answer" line per answer. Readable for staff, parsed back by giftDetailsFromText. */
export function giftDetailsToText(details: GiftDetails | undefined): string {
  return GIFT_QUESTIONS.filter((q) => (details?.[q.id] ?? '').trim()).map((q) => `${q.gift} · ${q.short}: ${details![q.id]!.trim()}`).join('\n');
}

export function giftDetailsFromText(text: string | undefined): GiftDetails {
  const out: GiftDetails = {};
  for (const line of (text ?? '').split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const q = GIFT_QUESTIONS.find((x) => `${x.gift} · ${x.short}` === key);
    if (q) out[q.id] = line.slice(i + 1).trim();
  }
  return out;
}
