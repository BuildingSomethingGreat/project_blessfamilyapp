import type { PublicFamily, PublicChild } from '@bless/shared';
import { AGE_GROUPS, NEED_FILTERS, colorSwatch, familyArt, type AgeGroupKey, type NeedKey } from '@bless/shared';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/format';

/**
 * Catalog filters. Three plain-language groups: how many kids, which ages, which clothing needs.
 * Within a group, options widen the search (any of them); across groups they narrow it.
 */
export type SizeKey = 'any' | '1' | '2' | '3+';
export type Filters = { size: SizeKey; ages: AgeGroupKey[]; needs: NeedKey[] };
export const EMPTY_FILTERS: Filters = { size: 'any', ages: [], needs: [] };
export const SIZE_OPTIONS: { key: SizeKey; label: string }[] = [
  { key: 'any', label: 'Any size' }, { key: '1', label: '1 child' }, { key: '2', label: '2 kids' }, { key: '3+', label: '3 or more' },
];

export function matchFilters(f: PublicFamily, flt: Filters) {
  if (flt.size === '1' && f.childCount !== 1) return false;
  if (flt.size === '2' && f.childCount !== 2) return false;
  if (flt.size === '3+' && f.childCount < 3) return false;
  if (flt.ages.length && !AGE_GROUPS.some((g) => flt.ages.includes(g.key) && f.children.some((k) => k.age >= g.min && k.age <= g.max))) return false;
  if (flt.needs.length && !NEED_FILTERS.some((n) => flt.needs.includes(n.key) && f.children.some((k) => (k.clothingWishlist as readonly string[]).includes(n.item)))) return false;
  return true;
}
export const filterCount = (flt: Filters) => (flt.size !== 'any' ? 1 : 0) + flt.ages.length + flt.needs.length;

/** One-line description of the active filters, e.g. "with a teen (13–17) who needs boots". */
export function describeFilters(flt: Filters): string {
  const parts: string[] = [];
  if (flt.size !== 'any') parts.push(flt.size === '1' ? 'with 1 child' : flt.size === '2' ? 'with 2 kids' : 'with 3 or more kids');
  if (flt.ages.length) parts.push('with ' + AGE_GROUPS.filter((g) => flt.ages.includes(g.key)).map((g) => `${g.label.toLowerCase()} (${g.range})`).join(' or '));
  if (flt.needs.length) parts.push('needing ' + NEED_FILTERS.filter((n) => flt.needs.includes(n.key)).map((n) => n.label.toLowerCase()).join(' or '));
  return parts.join(', ');
}
export function matchQuery(f: PublicFamily, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [f.nickname, f.city, ...f.children.flatMap((k) => [k.name, k.hobbies, ...k.clothingWishlist, ...k.giftTypes])].some((x) => x.toLowerCase().includes(s));
}
/** v3 "need chips": up to 3, dark for needs, soft for ages/interests. */
export function needChips(f: PublicFamily): { label: string; dark: boolean }[] {
  const order = ['Needs a winter coat', 'Needs boots', 'Needs shoes', 'Baby or toddler', 'Teen', 'Readers', 'Creatives', 'Athletes', 'Builders'];
  return order.filter((t) => f.tags.includes(t)).map((label) => ({ label, dark: label.startsWith('Needs') })).slice(0, 3);
}
/** Wrapping and labeling rules, repeated wherever a Holiday Konnector decides or shops. */
export const GIFT_RULES = ["Wrap every gift and label it with the child's name.", 'Include a gift receipt for each clothing item in case it doesn’t fit.', 'Buy the same number of gifts for each child so every child feels equally celebrated.'];

export const art = (f: PublicFamily) => familyArt(f.colors);
export const photoFor = (f: PublicFamily, show: boolean | undefined) => (show !== false && f.photoUrl ? f.photoUrl : undefined);

export function BackButton({ to, children, onClick }: { to?: string; children: React.ReactNode; onClick?: () => void }) {
  const cls = 'inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[13px] font-semibold text-ink';
  return to ? <Link to={to} className={cls}>{children}</Link> : <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

export function KidChip({ k, dark, className }: { k: PublicChild; dark?: boolean; className?: string }) {
  return <span className={cx('whitespace-nowrap rounded-full px-[11px] py-[5px] text-[13px] font-semibold', dark ? 'bg-white/12 text-white' : 'bg-soft-2 text-pri-dark', className)}>{k.name}, {k.age}</span>;
}

/** The per-child wishlist card from the v3 family detail. */
export function WishlistCard({ k, n }: { k: PublicChild; n: number }) {
  return (
    <div className="rounded-xl2 border border-line bg-white px-[22px] py-5">
      <div className="flex items-center justify-between gap-2.5">
        <div><div className="text-[11px] font-semibold uppercase tracking-[.1em] text-pri">Child {n}</div><div className="mt-0.5 whitespace-nowrap text-[22px] font-extrabold tracking-[-.03em]">{k.name}, {k.age}</div></div>
        {k.favoriteColor && <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-[5px] text-[12px] font-semibold"><span className="inline-block size-2.5 rounded-full" style={{ background: colorSwatch(k.favoriteColor) }} />{k.favoriteColor}</span>}
      </div>
      {k.hobbies && <div className="mt-1 text-[13px] text-ink-3">{k.hobbies}</div>}
      <div className="mt-3.5 grid grid-cols-3 gap-2">
        {[['Shirt', k.shirtSize, k.clothingCategory], ['Pants', k.pantsSize, k.clothingCategory], ['Shoes', k.shoeSize, k.shoeCategory]].map(([l, v, c]) => (
          <div key={l} className="rounded-[14px] bg-bg px-3 py-2.5"><div className="text-[10px] font-semibold uppercase tracking-[.08em] text-ink-3">{l}</div><div className="mt-0.5 text-[17px] font-bold">{v}</div><div className="text-[11px] text-ink-3">{c}</div></div>
        ))}
      </div>
      {k.sizeNotes && <div className="mt-2.5 rounded-[12px] bg-soft-2 px-3 py-2 text-[12px] text-ink-2"><b>Size notes:</b> {k.sizeNotes}</div>}
      <div className="mt-3.5 text-[12px] font-semibold text-ink-2">Clothing</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{[...k.clothingWishlist, ...(k.otherClothing ? [k.otherClothing] : [])].map((c) => <span key={c} className="rounded-full bg-soft px-2.5 py-[5px] text-[12px] font-semibold text-pri-dark">{c}</span>)}</div>
      <div className="mt-3 text-[12px] font-semibold text-ink-2">Fun gifts</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{[...k.giftTypes, ...(k.specificGifts ? [k.specificGifts] : [])].map((g) => <span key={g} className="rounded-full border border-line bg-bg px-2.5 py-[5px] text-[12px] font-semibold text-ink">{g}</span>)}</div>
    </div>
  );
}

/** Compact kid card used on the tracker. */
export function KidMini({ k }: { k: PublicChild }) {
  return (
    <div className="rounded-[22px] border border-line bg-white px-[18px] py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><b className="whitespace-nowrap text-base">{k.name}, {k.age}</b><span className="text-[12px] text-ink-3">{k.clothingCategory} · shirt {k.shirtSize} · pants {k.pantsSize} · shoe {k.shoeSize}</span></div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {k.clothingWishlist.map((c) => <span key={c} className="rounded-full bg-soft px-[9px] py-1 text-[12px] font-semibold text-pri-dark">{c}</span>)}
        {k.giftTypes.map((g) => <span key={g} className="rounded-full border border-line bg-bg px-[9px] py-1 text-[12px] font-semibold">{g}</span>)}
      </div>
    </div>
  );
}

export const shell = 'px-4 pb-16 pt-6 sm:px-8 sm:pt-8';
export const wrap = 'mx-auto max-w-[1240px]';
