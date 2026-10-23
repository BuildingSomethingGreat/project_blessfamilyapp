import type { PublicFamily, PublicChild } from '@bless/shared';
import { colorSwatch, familyArt } from '@bless/shared';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/format';

export const TAGS = ['All', '1 child', '2 kids', '3+ kids', 'Needs winter coats', 'Needs boots', 'Babies', 'Teens'] as const;

export function matchTag(f: PublicFamily, tag: string) {
  if (tag === 'All') return true;
  if (tag === '1 child') return f.childCount === 1;
  if (tag === '2 kids') return f.childCount === 2;
  if (tag === '3+ kids') return f.childCount >= 3;
  return f.tags.includes(tag);
}
export function matchQuery(f: PublicFamily, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [f.nickname, f.city, ...f.children.flatMap((k) => [k.name, k.hobbies, ...k.clothingWishlist, ...k.giftTypes])].some((x) => x.toLowerCase().includes(s));
}
/** v3 "need chips": up to 3, dark for needs, soft for ages/interests. */
export function needChips(f: PublicFamily): { label: string; dark: boolean }[] {
  const order = ['Needs winter coats', 'Needs boots', 'Needs shoes', 'Babies', 'Teens', 'Readers', 'Creatives', 'Athletes', 'Builders'];
  return order.filter((t) => f.tags.includes(t)).map((label) => ({ label, dark: label.startsWith('Needs') })).slice(0, 3);
}
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
