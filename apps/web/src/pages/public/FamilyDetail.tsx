import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { FamilyArt, Skeleton } from '@/components/ui';
import { cx, fmtDate } from '@/lib/format';
import { art, BackButton, GIFT_RULES, KidChip, needChips, photoFor, shell, WishlistCard, wrap } from './shared.tsx';
import NotFound from './NotFound.tsx';

export default function FamilyDetail() {
  const { slug = '' } = useParams();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['family', slug], queryFn: () => api.family(slug), retry: false });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 5 * 60_000 });
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCtaVisible(!!e?.isIntersecting), { rootMargin: '0px 0px -40px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [q.data]);

  if (q.error instanceof ApiError && q.error.status === 404) return <NotFound />;
  const f = q.data;
  const s = settings.data;
  const deadline = s ? fmtDate(s.dropoffDeadline, { weekday: 'short', month: 'short', day: 'numeric' }) : '…';
  const bless = () => { api.claimStart(slug).catch(() => {}); nav(`/families/${slug}/claim`); };
  const available = f?.status === 'Available';

  return (
    <div className={`${shell} anim-rise`}>
      <div className={wrap}>
        <BackButton to="/families">‹ All families</BackButton>
        {!f ? (
          <Skeleton className="mt-5 h-[520px] rounded-[36px]" />
        ) : (
          <>
            {/* Photo + decision, together: the first thing on the page is who they are and how to say yes. */}
            <section className="mt-5 grid overflow-hidden rounded-[36px] bg-ink text-white shadow-lift md:grid-cols-[1.05fr_1fr]">
              <FamilyArt art={art(f)} photoUrl={photoFor(f, s?.showPhotos)} className="min-h-[200px] rounded-none sm:min-h-[340px] md:min-h-[560px]" alt="">
                <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1.5 text-[12px] font-semibold text-ink">{f.waitLabel}</span>
                <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-ink/80 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-[8px]">{f.kidLine} · {f.city}</span>
              </FamilyArt>
              <div className="flex flex-col p-[clamp(24px,4vw,44px)]">
                <div className="text-[12px] font-semibold uppercase tracking-[.1em] text-lav">{f.city} · {f.familyId}</div>
                <h1 className="mt-2 text-[clamp(34px,4.4vw,56px)] font-extrabold leading-[.98] tracking-[-.045em] text-white">{f.nickname}</h1>
                <div className="mt-4 flex flex-wrap gap-1.5">{f.children.map((k) => <KidChip key={k.name + k.age} k={k} dark />)}</div>
                {needChips(f).length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{needChips(f).map((n) => <span key={n.label} className="rounded-full bg-lav px-[11px] py-1.5 text-[12px] font-semibold text-ink">{n.label}</span>)}</div>}
                {f.story && <p className="mt-5 hidden text-[16px] leading-[1.55] text-bg/85 md:line-clamp-4">“{f.story}”</p>}

                <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                  {[[String(f.childCount), f.childCount === 1 ? 'child to shop for' : 'kids to shop for'], ['$100–$250', 'typical per child'], [deadline, 'gifts due']].map(([v, l]) => (
                    <div key={l} className="rounded-[18px] bg-white/8 px-2 py-3"><div className="text-[clamp(15px,1.6vw,19px)] font-bold leading-tight">{v}</div><div className="mt-0.5 text-[11px] text-bg/65">{l}</div></div>
                  ))}
                </div>

                <div ref={ctaRef} className="mt-auto pt-6">
                  {available ? (
                    <>
                      <button onClick={bless} className="group flex h-[60px] w-full items-center justify-center gap-3 rounded-full bg-lav text-[17px] font-bold text-ink transition-colors hover:bg-white">
                        Bless this family <span aria-hidden className="grid size-8 place-items-center rounded-full bg-ink text-white transition-transform group-hover:translate-x-0.5">→</span>
                      </button>
                      <div className="mt-2.5 text-center text-[12px] text-bg/65">Takes about two minutes. No payment on this site.</div>
                      <ol className="mt-5 grid gap-2 text-[13px] text-bg/80">
                        {['Tell us who you are. We hold the family for you right away.', 'Get your private family page with every size and wish.', `Shop, wrap, and hand off the gifts by ${deadline}. We'll guide you.`].map((t, i) => (
                          <li key={i} className="flex gap-2.5"><span className="grid size-5 flex-none place-items-center rounded-full bg-white/12 text-[11px] font-bold text-white">{i + 1}</span>{t}</li>
                        ))}
                      </ol>
                      {s?.chipInsEnabled && <div className="mt-4 text-center text-[13px] text-bg/70">Can't take a whole family? <Link to={`/families/${slug}/chip-in`} className="font-semibold text-lav hover:text-white">Chip in toward their list</Link></div>}
                    </>
                  ) : (
                    <div className="rounded-[18px] bg-white/8 p-4 text-[14px] leading-[1.5] text-bg/85">
                      <b className="text-white">{f.status === 'Fulfilled' ? 'This family has been blessed.' : 'A Holiday Konnector has already chosen this family.'}</b> Thank you for looking. Other households are still waiting. <Link to="/families" className="font-semibold text-lav">See who's left →</Link>
                      {s?.chipInsEnabled && f.status === 'Claimed' && <div className="mt-3"><Link to={`/families/${slug}/chip-in`} className="inline-flex h-10 items-center rounded-full border border-white/30 px-4 text-[13px] font-semibold text-white">Chip in toward their list</Link></div>}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Details, after the decision. */}
            <div className="mt-8 grid items-start gap-5 lg:grid-cols-[1fr_1.5fr]">
              <div className="grid gap-3.5 lg:sticky lg:top-24">
                {f.story && (
                  <div className={cx('rounded-xl3 border border-line bg-white p-6', f.story.length <= 220 && 'md:hidden')}>
                    <div className="text-[12px] font-semibold uppercase tracking-[.1em] text-pri">In their words</div>
                    <p className="mt-2.5 text-[16px] leading-[1.6] text-ink-2">“{f.story}”</p>
                  </div>
                )}
                <div className="rounded-xl3 bg-soft p-6">
                  <h2 className="text-[18px] tracking-[-.03em]">Good to know</h2>
                  <p className="mt-1.5 text-[13px] leading-[1.5] text-ink-2">{s?.perChildBudgetNote ?? 'How much you spend is up to you. Holiday Konnectors typically spend $100–$250 per child.'}</p>
                  <ul className="mt-3 grid gap-2 text-[13px] leading-[1.5] text-ink-2">{GIFT_RULES.map((r) => <li key={r} className="flex gap-2"><span className="text-pri">✓</span>{r}</li>)}</ul>
                  <div className="mt-3 text-[13px] leading-[1.5] text-ink-2"><b className="text-ink">Hand-off:</b> deliver to the family yourself (we'll connect you privately), or drop off at {s?.dropoffLocation ?? 'our drop-off site'} by {deadline}, {(s?.dropoffHours ?? '').replace(/\.$/, '')}.</div>
                </div>
              </div>
              <div>
                <h2 className="text-[26px] tracking-[-.04em]">The wishlists</h2>
                <div className="mt-1 text-[13px] text-ink-3">First names, ages and sizes only. Every wish was written by a parent.</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{f.children.map((k, i) => <WishlistCard key={k.name + i} k={k} n={i + 1} />)}</div>
              </div>
            </div>

            {/* Mobile: keep the decision one tap away once the main button scrolls off. */}
            {available && createPortal(
              <div className={cx('fixed inset-x-3 bottom-[76px] z-30 transition-all duration-300 sm:hidden', ctaVisible ? 'pointer-events-none translate-y-4 opacity-0' : 'translate-y-0 opacity-100')}>
                <button onClick={bless} className="flex h-[54px] w-full items-center justify-between rounded-full bg-ink pl-5 pr-2 text-[15px] font-bold text-white shadow-lift">
                  <span className="truncate">Bless {f.nickname}</span><span className="grid h-10 flex-none place-items-center rounded-full bg-lav px-4 text-[14px] text-ink">Yes, I'll help →</span>
                </button>
              </div>,
              document.body,
            )}
          </>
        )}
      </div>
    </div>
  );
}
