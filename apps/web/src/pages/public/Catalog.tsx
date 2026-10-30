import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AGE_GROUPS, NEED_FILTERS, type PublicFamily } from '@bless/shared';
import { api } from '@/lib/api';
import { FamilyArt, Skeleton } from '@/components/ui';
import { Bokeh, FESTIVE, Layer, Prop, Snow } from '@/components/festive';
import { cx } from '@/lib/format';
import { art, describeFilters, EMPTY_FILTERS, filterCount, matchFilters, matchQuery, photoFor, shell, SIZE_OPTIONS, wrap, type Filters } from './shared.tsx';

const ss = { get: (k: string, d: string) => { try { return sessionStorage.getItem(k) ?? d; } catch { return d; } }, set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } } };

export default function Catalog() {
  const nav = useNavigate();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 5 * 60_000 });
  const [filters, setFilters] = useState<Filters>(() => { try { return { ...EMPTY_FILTERS, ...JSON.parse(ss.get('baf-cat-filters', '{}')) }; } catch { return EMPTY_FILTERS; } });
  const [query, setQuery] = useState(() => ss.get('baf-cat-q', ''));
  useEffect(() => { ss.set('baf-cat-filters', JSON.stringify(filters)); ss.set('baf-cat-q', query); }, [filters, query]);

  const all = catalog.data?.families ?? [];
  const shown = useMemo(() => all.filter((f) => matchFilters(f, filters) && matchQuery(f, query)), [all, filters, query]);
  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  /** How many families you'd see if this option were picked, given everything else selected. */
  const countWith = (patch: Partial<Filters>) => all.filter((f) => matchFilters(f, { ...filters, ...patch }) && matchQuery(f, query)).length;
  const toggle = <K extends 'ages' | 'needs'>(k: K, v: Filters[K][number]) => update({ [k]: (filters[k] as string[]).includes(v) ? (filters[k] as string[]).filter((x) => x !== v) : [...filters[k], v] } as Partial<Filters>);
  const active = filterCount(filters) > 0 || !!query.trim();
  const showPhotos = settings.data?.showPhotos;
  const open = (f: PublicFamily) => nav(`/families/${f.slug}`);

  return (
    <div className={`${shell} anim-rise relative overflow-x-clip`}>
      {/* back layer: lights, soft branches in the top corners, a light snowfall over the header area */}
      <Layer className="z-0">
        <div className="absolute inset-x-0 top-0 h-[520px] overflow-hidden">
          <Bokeh count={24} seed={5} />
          <Snow layer="back" density={0.7} />
        </div>
        <Prop src={FESTIVE.branch} flip blur={4} opacity={0.4} depth={-0.04} className="-right-[6%] -top-[60px] w-[clamp(220px,34vw,560px)]" />
        <Prop src={FESTIVE.branch} motion="sway" opacity={0.88} depth={0.02} className="-left-28 -top-24 w-[210px] sm:-left-24 sm:w-[260px] lg:-left-20 lg:-top-28 lg:w-[300px]" />
        <Prop src={FESTIVE.branch} flip motion="sway" opacity={0.88} depth={0.03} delay="-3s" className="-right-12 -top-14 w-[170px] sm:-right-10 sm:w-[240px] lg:-right-8 lg:-top-16 lg:w-[320px]" />
        <Prop src={FESTIVE.snowflake} motion="drift" opacity={0.6} blur={0.5} depth={-0.04} className="left-[3%] top-[34%] hidden w-[56px] md:block" />
        <Prop src={FESTIVE.snowflake} motion="drift" opacity={0.5} blur={0.8} depth={-0.03} delay="-5s" className="right-[4%] top-[58%] hidden w-[48px] lg:block" />
      </Layer>
      <div className={`${wrap} relative z-10 lg:pt-6`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><div className="text-[12px] font-semibold uppercase tracking-[.1em] text-pri">Bless-a-Family {settings.data?.season ?? ''}</div><h1 className="mt-1.5 text-[clamp(36px,5vw,64px)] font-extrabold leading-none tracking-[-.045em]">Families waiting <span className="text-muted-lav">· {catalog.data ? shown.length : '…'}</span></h1></div>
        </div>
        <div className="mt-5 rounded-[26px] border border-line-2 bg-white/88 p-3 shadow-soft backdrop-blur-[10px] sm:p-4">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">⌕</span>
            <input value={query} onChange={(e) => { setQuery(e.target.value); }} placeholder="Search a first name, interest, or city" aria-label="Search families" className="h-[46px] w-full rounded-full border border-line bg-bg pl-10 pr-4 text-[14px] outline-none focus:border-pri focus:bg-white" />
          </div>
          <div className="mt-3 grid gap-2.5">
            <FilterRow label="Kids in the family">
              {SIZE_OPTIONS.map((o) => <FilterChip key={o.key} on={filters.size === o.key} count={o.key === 'any' ? undefined : countWith({ size: o.key })} onClick={() => update({ size: filters.size === o.key && o.key !== 'any' ? 'any' : o.key })}>{o.label}</FilterChip>)}
            </FilterRow>
            <FilterRow label="Has a child who is">
              {AGE_GROUPS.map((g) => <FilterChip key={g.key} on={filters.ages.includes(g.key)} count={countWith({ ages: filters.ages.includes(g.key) ? filters.ages : [...filters.ages, g.key] })} onClick={() => toggle('ages', g.key)}>{g.label} <span className="font-medium opacity-70">{g.range}</span></FilterChip>)}
            </FilterRow>
            <FilterRow label="Needs a">
              {NEED_FILTERS.map((n) => <FilterChip key={n.key} on={filters.needs.includes(n.key)} count={countWith({ needs: filters.needs.includes(n.key) ? filters.needs : [...filters.needs, n.key] })} onClick={() => toggle('needs', n.key)}>{n.label}</FilterChip>)}
            </FilterRow>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line-2 pt-3 text-[13px]" aria-live="polite">
            <span className="text-ink-2">{catalog.data ? <>Showing <b className="text-ink">{shown.length}</b> of {all.length} {all.length === 1 ? 'family' : 'families'}{filterCount(filters) ? ` ${describeFilters(filters)}` : ''}{query.trim() ? ` matching “${query.trim()}”` : ''}</> : 'Loading families…'}</span>
            {active && <button onClick={() => { setFilters(EMPTY_FILTERS); setQuery(''); }} className="font-semibold text-pri hover:text-ink">Clear all</button>}
          </div>
        </div>

        {!catalog.data ? (
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[380px] rounded-[28px]" />)}</div>
        ) : (
          <>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((f) => (
                <button key={f.slug} onClick={() => open(f)} className="flex flex-col overflow-hidden rounded-xl3 border border-line bg-white text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                  <FamilyArt art={art(f)} photoUrl={photoFor(f, showPhotos)} className="h-[220px]">
                    <span className="pointer-events-none absolute left-3.5 top-3.5 rounded-full bg-white/92 px-2.5 py-[5px] text-[12px] font-semibold">{f.waitLabel}</span>
                    <span className="pointer-events-none absolute bottom-3.5 right-3.5 rounded-full bg-ink px-2.5 py-[5px] text-[12px] font-semibold text-white">{f.kidLine}</span>
                  </FamilyArt>
                  <div className="px-5 pb-5 pt-[18px]">
                    <div className="flex items-baseline justify-between gap-2.5"><h3 className="text-[21px] tracking-[-.035em]">{f.nickname}</h3><span className="text-[12px] text-ink-3">{f.city}</span></div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">{f.children.map((k) => <span key={k.name + k.age} className="whitespace-nowrap rounded-full bg-soft px-2.5 py-[5px] text-[13px] font-semibold text-pri-dark">{k.name}, {k.age}</span>)}</div>
                    {f.story && <p className="mt-3 line-clamp-2 text-[14px] leading-[1.5] text-ink-2">“{f.story}”</p>}
                    {settings.data?.chipInsEnabled && f.raised > 0 && (
                      <div className="mt-3.5"><div className="flex justify-between text-[12px] font-semibold"><span className="text-pri">${f.raised} chipped in</span><span className="text-ink-3">of ${f.goal}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-pri" style={{ width: `${Math.min(100, Math.round((f.raised / f.goal) * 100))}%` }} /></div></div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {shown.length === 0 && <div className="mt-7 rounded-xl3 border border-dashed border-line bg-white p-10 text-center"><div className="font-bold">No families match that</div><div className="mt-1 text-[13px] text-ink-3">Try widening a filter, or <button onClick={() => { setFilters(EMPTY_FILTERS); setQuery(''); }} className="font-semibold text-pri">clear them all</button>.</div></div>}
          </>
        )}
      </div>
      {/* front layer: an ornament hangs over the header edge and the first snowflakes drift above the content */}
      <Layer className="z-20">
        <Prop src={FESTIVE.ornament} motion="swing" depth={0.06} className="right-[clamp(300px,34vw,520px)] -top-6 hidden w-[clamp(52px,6vw,92px)] lg:block" />
        <div className="absolute inset-x-0 top-0 h-[520px]"><Snow layer="front" density={0.5} /></div>
      </Layer>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="w-[150px] flex-none text-[12px] font-semibold uppercase tracking-[.08em] text-ink-3">{label}</div>
      <div className="rail -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">{children}</div>
    </div>
  );
}

function FilterChip({ on, count, onClick, children }: { on: boolean; count?: number; onClick: () => void; children: React.ReactNode }) {
  const empty = count === 0 && !on;
  return (
    <button type="button" onClick={onClick} aria-pressed={on} disabled={empty}
      className={cx('inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all',
        on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-ink-3', empty && 'cursor-not-allowed opacity-45 hover:border-line')}>
      {on && <span aria-hidden>✓</span>}{children}
      {count !== undefined && <span className={cx('rounded-full px-1.5 text-[11px]', on ? 'bg-white/18' : 'bg-soft text-pri-dark')}>{count}</span>}
    </button>
  );
}
