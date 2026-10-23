import type { PublicChild } from '@bless/shared';
import { colorToHex } from '@bless/shared';
import { Chip } from '@/components/ui';

function Size({ label, cat, size }: { label: string; cat: string; size: string }) {
  return (
    <div className="rounded-2xl bg-cream-2/70 px-3.5 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</div>
      <div className="mt-1 text-[15px] font-semibold leading-tight">{size}</div>
      <div className="text-xs text-ink-3">{cat}</div>
    </div>
  );
}

export function ChildWishlist({ c, index }: { c: PublicChild; index: number }) {
  const hex = colorToHex(c.favoriteColor);
  return (
    <section className="rounded-xl3 border border-line/70 bg-paper p-5 shadow-soft sm:p-6" aria-labelledby={`child-${index}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ember">Child {index + 1}</p>
          <h3 id={`child-${index}`} className="mt-1 text-2xl sm:text-3xl">{c.name}, {c.age}</h3>
          <p className="text-sm text-ink-3">{c.gender === 'Female' ? 'Girl' : 'Boy'}{c.hobbies ? ` · Loves ${c.hobbies}` : ''}</p>
        </div>
        {c.favoriteColor && (
          <div className="flex items-center gap-2 rounded-full border border-line bg-cream px-3 py-1.5 text-xs font-medium">
            <span className="size-3.5 rounded-full ring-1 ring-ink/10" style={{ background: hex ?? '#ccc' }} aria-hidden />
            {c.favoriteColor}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Size label="Shirt / Top" cat={c.clothingCategory} size={c.shirtSize} />
        <Size label="Pants" cat={c.clothingCategory} size={c.pantsSize} />
        <Size label="Shoes" cat={c.shoeCategory} size={c.shoeSize} />
      </div>
      {c.sizeNotes && (
        <p className="mt-2 rounded-2xl bg-gold-soft px-3.5 py-2.5 text-sm text-[#6b4a0a]"><span className="font-semibold">Sizing note:</span> {c.sizeNotes}</p>
      )}

      {(c.clothingWishlist.length > 0 || c.otherClothing) && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-ink-2">Clothing wishlist</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.clothingWishlist.map((w) => <Chip key={w} tone={w === 'Winter Coat' ? 'ember' : 'neutral'}>{w}</Chip>)}
          </div>
          {c.otherClothing && <p className="mt-2 text-[15px] text-ink-2">{c.otherClothing}</p>}
        </div>
      )}

      {(c.giftTypes.length > 0 || c.specificGifts) && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-ink-2">Fun gifts</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.giftTypes.map((g) => <Chip key={g} tone="pine">{g}</Chip>)}
          </div>
          {c.specificGifts && <p className="mt-2 text-[15px] text-ink-2">{c.specificGifts}</p>}
        </div>
      )}
    </section>
  );
}
