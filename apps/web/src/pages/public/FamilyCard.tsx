import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import type { PublicFamily } from '@bless/shared';
import { FamilyArt, Chip } from '@/components/ui';
import { rise } from '@/components/ui/Page';
import { plural } from '@/lib/format';

export function FamilyCard({ f, index = 0 }: { f: PublicFamily; index?: number }) {
  const seed = [...f.slug].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <motion.article variants={rise} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }} className="group">
      <Link to={`/families/${f.slug}`} className="block overflow-hidden rounded-xl3 border border-line/70 bg-paper shadow-soft transition-shadow duration-300 hover:shadow-lift focus-visible:outline-offset-4">
        <div className="relative aspect-[4/3]">
          <FamilyArt colors={f.colors} seed={seed + index} className="h-full w-full transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.03]" />
          <div className="absolute left-3 top-3 flex gap-2">
            <span className="rounded-full bg-paper/90 px-2.5 py-1 text-[12px] font-semibold text-ink backdrop-blur">
              {f.daysWaiting === 0 ? 'New today' : `Waiting ${plural(f.daysWaiting, 'day')}`}
            </span>
          </div>
          <span className="absolute bottom-3 right-3 rounded-full bg-ink/80 px-2.5 py-1 text-[12px] font-semibold text-cream backdrop-blur">
            {f.childCount === 1 ? '1 child' : `${f.childCount} kids`}
          </span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-xl leading-tight sm:text-[22px]">{f.nickname}</h3>
            <span className="shrink-0 text-xs font-medium text-ink-3">{f.city}</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {f.children.map((c) => (
              <span key={c.name + c.age} className="rounded-full bg-cream-2 px-2.5 py-1 text-[13px] font-medium text-ink-2">
                {c.name}, {c.age}
              </span>
            ))}
          </div>
          {f.story && <p className="mt-3 line-clamp-2 text-[15px] leading-snug text-ink-2">“{f.story}”</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {f.tags.filter((t) => !/^\d|Big family/.test(t)).slice(0, 3).map((t) => (
              <Chip key={t} tone={t.startsWith('Needs') ? 'ember' : 'pine'} className="px-2.5 py-1 text-[12px]">{t}</Chip>
            ))}
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

export function FamilyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl3 border border-line/70 bg-paper">
      <div className="aspect-[4/3] animate-pulse bg-cream-2" />
      <div className="space-y-3 p-5">
        <div className="h-6 w-2/3 animate-pulse rounded-full bg-cream-2" />
        <div className="flex gap-2"><div className="h-6 w-20 animate-pulse rounded-full bg-cream-2" /><div className="h-6 w-16 animate-pulse rounded-full bg-cream-2" /></div>
        <div className="h-4 w-full animate-pulse rounded-full bg-cream-2" />
      </div>
    </div>
  );
}
