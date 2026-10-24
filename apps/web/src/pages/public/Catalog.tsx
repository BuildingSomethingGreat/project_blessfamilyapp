import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PublicFamily } from '@bless/shared';
import { api } from '@/lib/api';
import { FamilyArt, Skeleton } from '@/components/ui';
import { Bokeh, FESTIVE, Layer, Prop, Snow } from '@/components/festive';
import { cx } from '@/lib/format';
import { art, KidChip, matchQuery, matchTag, needChips, photoFor, shell, TAGS, wrap } from './shared.tsx';

const ss = { get: (k: string, d: string) => { try { return sessionStorage.getItem(k) ?? d; } catch { return d; } }, set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } } };
const ls = { get: (): string[] => { try { return JSON.parse(localStorage.getItem('baf-saved') ?? '[]'); } catch { return []; } }, set: (v: string[]) => { try { localStorage.setItem('baf-saved', JSON.stringify(v)); } catch { /* ignore */ } } };

export default function Catalog() {
  const nav = useNavigate();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 5 * 60_000 });
  const [mode, setMode] = useState<'swipe' | 'grid'>(() => (ss.get('baf-cat-mode', 'swipe') as 'swipe' | 'grid'));
  const [tag, setTag] = useState(() => ss.get('baf-cat-tag', 'All'));
  const [query, setQuery] = useState(() => ss.get('baf-cat-q', ''));
  const [saved, setSaved] = useState<string[]>(ls.get);
  const [deckIdx, setDeckIdx] = useState(0);
  useEffect(() => { ss.set('baf-cat-mode', mode); ss.set('baf-cat-tag', tag); ss.set('baf-cat-q', query); }, [mode, tag, query]);
  useEffect(() => ls.set(saved), [saved]);

  const all = catalog.data?.families ?? [];
  const shown = useMemo(() => all.filter((f) => matchTag(f, tag) && matchQuery(f, query)), [all, tag, query]);
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
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] max-w-[360px] flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">⌕</span>
            <input value={query} onChange={(e) => { setQuery(e.target.value); setDeckIdx(0); }} placeholder="Search names, interests, city" className="h-[46px] w-full rounded-full border border-line bg-white pl-10 pr-4 text-[14px] outline-none focus:border-pri" />
          </div>
          <div className="rail flex flex-1 gap-1.5 overflow-x-auto p-0.5">
            {TAGS.map((t) => <button key={t} onClick={() => { setTag(t); setDeckIdx(0); }} className={cx('flex-none rounded-full px-3.5 py-2.5 text-[13px] font-semibold transition-all', tag === t ? 'bg-ink text-white' : 'bg-white text-ink-2')}>{t}</button>)}
          </div>
        </div>

        {!catalog.data ? (
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[380px] rounded-[28px]" />)}</div>
        ) : mode === 'swipe' ? (
          <>
            <div className="relative">
              <Deck families={shown} idx={deckIdx} setIdx={setDeckIdx} saved={saved} setSaved={setSaved} open={open} showPhotos={showPhotos} />
              {/* gifts and a lantern lean over the stage corners; purely decorative, never over the card or the skip/save zones */}
              <Prop src={FESTIVE.gifts} motion="hover" depth={0.04} className="z-20 -bottom-5 -left-3 hidden w-[clamp(96px,11vw,176px)] sm:block lg:-left-6" />
              <Prop src={FESTIVE.lantern} motion="hover" delay="-3s" depth={0.06} className="z-20 -bottom-3 -right-2 hidden w-[clamp(56px,6vw,104px)] sm:block lg:-right-4" />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
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
            {shown.length === 0 && <div className="mt-7 rounded-xl3 border border-dashed border-line bg-white p-10 text-center"><div className="font-bold">No families match that</div><div className="mt-1 text-[13px] text-ink-3">Try another filter or clear the search.</div></div>}
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
