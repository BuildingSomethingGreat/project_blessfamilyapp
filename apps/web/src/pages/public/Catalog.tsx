import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import type { PublicFamily } from '@bless/shared';
import { api } from '@/lib/api';
import { Chip, EmptyState, Page, Select, Button } from '@/components/ui';
import { stagger } from '@/components/ui/Page';
import { FamilyCard, FamilyCardSkeleton } from './FamilyCard.tsx';

type Sort = 'waiting' | 'newest' | 'fewest' | 'most';
const TAG_ORDER = ['1 child', '2 kids', '3 kids', 'Big family', 'Babies', 'Little kids', 'Kids', 'Tweens', 'Teens', 'Needs winter coats', 'Needs shoes', 'Readers', 'Athletes', 'Creatives', 'Builders'];

const readSession = <T,>(k: string, d: T): T => {
  try { const v = sessionStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; }
};

export function matchesQuery(f: PublicFamily, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [f.nickname, f.city, ...f.tags, ...f.children.map((c) => c.name), ...f.children.flatMap((c) => [c.hobbies, ...c.giftTypes, ...c.clothingWishlist])].some((x) => x?.toLowerCase().includes(s));
}

export default function Catalog() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['catalog'], queryFn: api.catalog });
  const [q, setQ] = useState(() => readSession('baf-catalog-q', ''));
  const [tag, setTag] = useState<string>(() => readSession('baf-catalog-tag', 'All'));
  const [sort, setSort] = useState<Sort>(() => readSession('baf-catalog-sort', 'waiting'));
  useEffect(() => { try { sessionStorage.setItem('baf-catalog-q', JSON.stringify(q)); sessionStorage.setItem('baf-catalog-tag', JSON.stringify(tag)); sessionStorage.setItem('baf-catalog-sort', JSON.stringify(sort)); } catch { /* ignore */ } }, [q, tag, sort]);

  const families = data?.families ?? [];
  const tags = useMemo(() => {
    const present = new Set(families.flatMap((f) => f.tags));
    return ['All', ...TAG_ORDER.filter((t) => present.has(t))];
  }, [families]);

  const shown = useMemo(() => {
    const list = families.filter((f) => (tag === 'All' || f.tags.includes(tag)) && matchesQuery(f, q));
    const by: Record<Sort, (a: PublicFamily, b: PublicFamily) => number> = {
      waiting: (a, b) => b.daysWaiting - a.daysWaiting,
      newest: (a, b) => a.daysWaiting - b.daysWaiting,
      fewest: (a, b) => a.childCount - b.childCount || b.daysWaiting - a.daysWaiting,
      most: (a, b) => b.childCount - a.childCount || b.daysWaiting - a.daysWaiting,
    };
    return [...list].sort(by[sort]);
  }, [families, tag, q, sort]);

  return (
    <Page className="py-8 sm:py-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-ember">Bless-A-Family {new Date().getFullYear()}</p>
          <h1 className="display-tight mt-2 text-4xl sm:text-6xl">
            Families waiting{data ? <span className="text-ink-3"> · {data.counts.available}</span> : null}
          </h1>
          <p className="mt-3 max-w-xl text-[17px] text-ink-2">Every family here was referred through The Konnection and reviewed by our team. Pick one, shop their wishlist, and we handle the rest.</p>
        </div>
        <div className="flex gap-2 sm:w-80">
          <label className="relative flex-1">
            <span className="sr-only">Search families</span>
            <svg className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, interests, city" className="h-12 w-full rounded-full border border-line bg-paper pl-11 pr-4 text-[15px] focus:border-ink focus:outline-none" />
          </label>
        </div>
      </div>

      <div className="sticky top-14 z-30 -mx-4 mt-6 bg-cream/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rail flex flex-1 gap-2 overflow-x-auto pr-2">
            {tags.map((t) => (
              <Chip key={t} active={tag === t} onClick={() => setTag(t)} tone={t.startsWith('Needs') ? 'ember' : 'neutral'}>{t}</Chip>
            ))}
          </div>
          <div className="w-[8.5rem] shrink-0 sm:w-44">
            <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="!h-10 !rounded-full !py-0 !pl-3.5 !pr-8 !text-[13px] sm:!text-sm" aria-label="Sort families">
              <option value="waiting">Longest wait</option>
              <option value="newest">Newest</option>
              <option value="fewest">Fewest kids</option>
              <option value="most">Most kids</option>
            </Select>
          </div>
        </div>
      </div>

      {isError ? (
        <div className="mt-8"><EmptyState title="We couldn't load families" body="Check your connection and try again." action={<Button onClick={() => refetch()}>Try again</Button>} /></div>
      ) : isLoading ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <FamilyCardSkeleton key={i} />)}</div>
      ) : shown.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={families.length === 0 ? 'Every family has been claimed' : 'No families match that'}
            body={families.length === 0 ? 'Thank you, Detroit. Check back soon or register a family you know.' : 'Try a different filter or clear the search.'}
            action={families.length === 0 ? <Link to="/register"><Button>Register a family</Button></Link> : <Button variant="secondary" onClick={() => { setQ(''); setTag('All'); }}>Clear filters</Button>}
          />
        </div>
      ) : (
        <motion.div key={tag + sort + q} variants={stagger} initial="hidden" animate="show" className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((f, i) => <FamilyCard key={f.slug} f={f} index={i} />)}
        </motion.div>
      )}

      {data && (
        <p className="mt-12 text-center text-sm text-ink-3">
          {data.counts.claimed + data.counts.fulfilled > 0 ? <><span className="font-semibold text-ink">{data.counts.claimed + data.counts.fulfilled}</span> {data.counts.claimed + data.counts.fulfilled === 1 ? 'family has' : 'families have'} already been claimed this season. </> : null}
          Know a family who could use a hand? <Link to="/register" className="font-semibold text-ember underline-offset-2 hover:underline">Register them</Link>.
        </p>
      )}
    </Page>
  );
}
