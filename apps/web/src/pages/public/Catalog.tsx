import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AGE_GROUPS, NEED_FILTERS, type PublicFamily } from '@bless/shared';
import { api } from '@/lib/api';
import { FamilyArt, Skeleton } from '@/components/ui';
import { Bokeh, FESTIVE, Layer, Prop, Snow } from '@/components/festive';
import { cx } from '@/lib/format';
import { art, describeFilters, EMPTY_FILTERS, filterCount, KidChip, matchFilters, matchQuery, needChips, photoFor, shell, SIZE_OPTIONS, wrap, type Filters } from './shared.tsx';

const ss = { get: (k: string, d: string) => { try { return sessionStorage.getItem(k) ?? d; } catch { return d; } }, set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } } };
const ls = { get: (): string[] => { try { return JSON.parse(localStorage.getItem('baf-saved') ?? '[]'); } catch { return []; } }, set: (v: string[]) => { try { localStorage.setItem('baf-saved', JSON.stringify(v)); } catch { /* ignore */ } } };

export default function Catalog() {
  const nav = useNavigate();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 5 * 60_000 });
  const [mode, setMode] = useState<'swipe' | 'grid'>(() => (ss.get('baf-cat-mode', 'swipe') as 'swipe' | 'grid'));
  const [filters, setFilters] = useState<Filters>(() => { try { return { ...EMPTY_FILTERS, ...JSON.parse(ss.get('baf-cat-filters', '{}')) }; } catch { return EMPTY_FILTERS; } });
  const [query, setQuery] = useState(() => ss.get('baf-cat-q', ''));
  const [saved, setSaved] = useState<string[]>(ls.get);
  const [deckIdx, setDeckIdx] = useState(0);
  useEffect(() => { ss.set('baf-cat-mode', mode); ss.set('baf-cat-filters', JSON.stringify(filters)); ss.set('baf-cat-q', query); }, [mode, filters, query]);
  useEffect(() => ls.set(saved), [saved]);

  const all = catalog.data?.families ?? [];
  const shown = useMemo(() => all.filter((f) => matchFilters(f, filters) && matchQuery(f, query)), [all, filters, query]);
  const update = (patch: Partial<Filters>) => { setFilters((f) => ({ ...f, ...patch })); setDeckIdx(0); };
  /** How many families you'd see if this option were picked, given everything else selected. */
  const countWith = (patch: Partial<Filters>) => all.filter((f) => matchFilters(f, { ...filters, ...patch }) && matchQuery(f, query)).length;
  const toggle = <K extends 'ages' | 'needs'>(k: K, v: Filters[K][number]) => update({ [k]: (filters[k] as string[]).includes(v) ? (filters[k] as string[]).filter((x) => x !== v) : [...filters[k], v] } as Partial<Filters>);
  const active = filterCount(filters) > 0 || !!query.trim();
  const showPhotos = settings.data?.showPhotos;
  const open = (f: PublicFamily) => nav(`/families/${f.slug}`);
  const savedList = saved.map((s) => all.find((f) => f.slug === s)).filter((x): x is PublicFamily => !!x);

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
          <div><div className="text-[12px] font-semibold uppercase tracking-[.1em] text-pri">Bless-A-Family {settings.data?.season ?? ''}</div><h1 className="mt-1.5 text-[clamp(36px,5vw,64px)] font-extrabold leading-none tracking-[-.045em]">Families waiting <span className="text-muted-lav">· {catalog.data ? shown.length : '…'}</span></h1></div>
          <div className="flex gap-1 rounded-full bg-soft p-1">
            {(['swipe', 'grid'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={cx('rounded-full px-4 py-[9px] text-[13px] font-semibold capitalize transition-all', mode === m ? 'bg-ink text-white' : 'text-pri-dark')}>{m}</button>)}
          </div>
        </div>
        <div className="mt-5 rounded-[26px] border border-line-2 bg-white/88 p-3 shadow-soft backdrop-blur-[10px] sm:p-4">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">⌕</span>
            <input value={query} onChange={(e) => { setQuery(e.target.value); setDeckIdx(0); }} placeholder="Search a first name, interest, or city" aria-label="Search families" className="h-[46px] w-full rounded-full border border-line bg-bg pl-10 pr-4 text-[14px] outline-none focus:border-pri focus:bg-white" />
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
            {active && <button onClick={() => { setFilters(EMPTY_FILTERS); setQuery(''); setDeckIdx(0); }} className="font-semibold text-pri hover:text-ink">Clear all</button>}
          </div>
        </div>

        {!catalog.data ? (
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[380px] rounded-[28px]" />)}</div>
        ) : mode === 'swipe' ? (
          <>
            <div className="relative">
              <Deck families={shown} idx={deckIdx} setIdx={setDeckIdx} saved={saved} setSaved={setSaved} open={open} showPhotos={showPhotos} />
              {/* gifts and a lantern sit on the stage's bottom corners; decorative only, kept inside the stage so they
                  never reach the card, the skip/save zones or the Saved row below */}
              <Prop src={FESTIVE.gifts} motion="hover" depth={0.04} className="z-20 bottom-4 -left-3 hidden w-[clamp(96px,11vw,160px)] sm:block lg:-left-6" />
              <Prop src={FESTIVE.lantern} motion="hover" delay="-3s" depth={0.06} className="z-20 bottom-8 -right-2 hidden w-[clamp(56px,6vw,96px)] sm:block lg:-right-4" />
            </div>
            <div className="relative z-30 mt-5 flex flex-wrap items-center gap-3">
              <div className="text-[15px] font-semibold">Saved <span className="font-medium text-ink-3">· {savedList.length}</span></div>
              {savedList.length === 0 && <span className="text-[13px] text-ink-3">Swipe right on a family to keep them here.</span>}
              {savedList.map((s) => (
                <button key={s.slug} onClick={() => open(s)} className="anim-pop flex items-center gap-2.5 rounded-full border border-line-2 bg-white py-1.5 pl-1.5 pr-3.5 transition-colors hover:border-pri">
                  <span className="block size-[30px] rounded-full" style={{ background: art(s) }} /><span className="whitespace-nowrap text-[13px] font-semibold">{s.nickname}</span><span className="whitespace-nowrap text-[12px] text-ink-3">{s.kidLine}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((f) => (
                <button key={f.slug} onClick={() => open(f)} className="overflow-hidden rounded-xl3 border border-line bg-white text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
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

function Deck({ families, idx, setIdx, saved, setSaved, open, showPhotos }: { families: PublicFamily[]; idx: number; setIdx: (n: number) => void; saved: string[]; setSaved: (s: string[]) => void; open: (f: PublicFamily) => void; showPhotos?: boolean }) {
  const deck = families.slice(idx);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flying, setFlying] = useState<'left' | 'right' | null>(null);
  const start = useRef({ x: 0, t: 0 });
  const fly = useCallback((dir: 'left' | 'right') => {
    const top = deck[0];
    if (!top || flying) return;
    setFlying(dir); setDx(dir === 'right' ? 700 : -700);
    setTimeout(() => { setFlying(null); setDx(0); setIdx(idx + 1); if (dir === 'right' && !saved.includes(top.slug)) setSaved([...saved, top.slug]); }, 320);
  }, [deck, flying, idx, saved, setIdx, setSaved]);
  const onDown = (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); setDragging(true); start.current = { x: e.clientX, t: Date.now() }; setDx(0); };
  const onMove = (e: React.PointerEvent) => { if (dragging) setDx(e.clientX - start.current.x); };
  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    const quick = Date.now() - start.current.t < 250;
    if (Math.abs(dx) < 8 && quick) { const top = deck[0]; if (top) open(top); setDx(0); return; }
    if (dx > 110) fly('right'); else if (dx < -110) fly('left'); else setDx(0);
  };
  const zoneT = dragging ? 'none' : 'opacity .35s, transform .35s';
  const zSkip = flying === 'left' ? 1 : Math.min(1, Math.max(0, -dx / 140));
  const zSave = flying === 'right' ? 1 : Math.min(1, Math.max(0, dx / 140));
  const cards = deck.slice(0, 3).map((f, i) => ({ f, i, top: i === 0, transform: i === 0 ? `translateX(${dx}px) rotate(${dx / 18}deg)` : `translateY(${i * 14}px) scale(${1 - i * 0.05})`, transition: dragging && i === 0 ? 'none' : 'transform .35s cubic-bezier(.16,1,.3,1), opacity .3s', z: 10 - i, opacity: i === 0 && flying ? 0 : 1 })).reverse();
  return (
    <div className="relative mt-6 flex flex-col items-center overflow-hidden rounded-[40px] bg-ink px-4 pb-7 pt-[clamp(28px,4vw,48px)]">
      <div className="pointer-events-none absolute inset-y-0 left-0 right-1/2 flex items-center pl-[clamp(20px,4vw,56px)]" style={{ background: 'linear-gradient(90deg,rgba(214,69,69,.85),rgba(214,69,69,0))', opacity: zSkip, transition: zoneT }}>
        <div className="origin-left text-white" style={{ transform: `scale(${0.85 + zSkip * 0.15})`, transition: zoneT }}><div className="grid size-16 place-items-center rounded-full border-2 border-white text-[26px]">✕</div><div className="mt-2.5 text-[clamp(28px,3.4vw,44px)] font-bold tracking-[-.04em]">Skip</div></div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 right-0 flex items-center justify-end pr-[clamp(20px,4vw,56px)]" style={{ background: 'linear-gradient(270deg,rgba(38,160,110,.85),rgba(38,160,110,0))', opacity: zSave, transition: zoneT }}>
        <div className="origin-right text-right text-white" style={{ transform: `scale(${0.85 + zSave * 0.15})`, transition: zoneT }}><div className="ml-auto grid size-16 place-items-center rounded-full border-2 border-white text-[26px]">♥</div><div className="mt-2.5 text-[clamp(28px,3.4vw,44px)] font-bold tracking-[-.04em]">Save</div></div>
      </div>
      <div className="relative h-[620px] w-full max-w-[400px] select-none" style={{ touchAction: 'none' }}>
        {deck.length === 0 && (
          <div className="anim-pop absolute inset-0 flex flex-col items-center justify-center rounded-[36px] bg-white p-8 text-center">
            <div className="grid size-[72px] place-items-center rounded-full bg-soft-2 text-[30px] text-pri">♡</div>
            <h2 className="mt-[18px] text-[30px] tracking-[-.045em]">You've met everyone.</h2>
            <p className="mt-2.5 text-[14px] leading-[1.5] text-ink-4">{saved.length} saved. Pick one below, or start over.</p>
            <button onClick={() => setIdx(0)} className="mt-[22px] h-12 rounded-full bg-ink px-[22px] font-semibold text-white">Start over</button>
          </div>
        )}
        {cards.map(({ f, i, top, transform, transition, z, opacity }) => (
          <div key={f.slug} className="absolute inset-0" style={{ transform, transition, zIndex: z, opacity }}>
            <div className="flex h-full flex-col rounded-[36px] bg-white px-5 pb-4 pt-5 shadow-deck">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5"><span className="grid size-[34px] place-items-center rounded-full bg-ink"><span className="block size-3 rounded-[4px] bg-lav" /></span><div><div className="text-[13px] font-semibold leading-[1.1]">{f.city}</div><div className="text-[11px] text-ink-3">{f.waitLabel}</div></div></div>
                <span className="text-[20px] leading-none tracking-[1px] text-ink">•••</span>
              </div>
              <div className="balance mt-[18px] text-[clamp(38px,4.2vw,46px)] font-bold leading-[.98] tracking-[-.05em] text-ink">{f.nickname}</div>
              <div className="mt-3.5 flex flex-wrap gap-1.5">{f.children.map((k) => <KidChip key={k.name + k.age} k={k} />)}</div>
              <FamilyArt art={art(f)} photoUrl={photoFor(f, showPhotos)} className="mt-4 min-h-0 flex-1 rounded-[26px]">
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">{needChips(f).map((n) => <span key={n.label} className="rounded-full bg-white/94 px-2.5 py-[5px] text-[12px] font-semibold text-ink">{n.label}</span>)}</div>
              </FamilyArt>
            </div>
            {top && <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className="absolute inset-0 cursor-grab rounded-[36px] active:cursor-grabbing" style={{ zIndex: i + 1 }} />}
          </div>
        ))}
      </div>
      <div className="relative mt-6 flex items-center gap-3.5">
        <button onClick={() => fly('left')} title="Skip" className="size-[60px] rounded-full border border-white/20 bg-white/8 text-[20px] text-white transition-colors hover:bg-[rgba(214,69,69,.9)]">✕</button>
        <button onClick={() => { const t = deck[0]; if (t) open(t); }} className="h-[60px] rounded-full bg-white px-7 text-base font-semibold text-ink transition-colors hover:bg-lav">Bless this family</button>
        <button onClick={() => fly('right')} title="Save" className="size-[60px] rounded-full border border-white/20 bg-white/8 text-[20px] text-white transition-colors hover:bg-[rgba(38,160,110,.9)]">♥</button>
      </div>
      <div className="relative mt-3 text-[12px] text-white/55">Drag the card · ← skip · → save · tap to open</div>
    </div>
  );
}
