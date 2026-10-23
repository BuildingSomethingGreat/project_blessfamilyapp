import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { FamilyArt, Skeleton } from '@/components/ui';
import { art, BackButton, KidChip, needChips, photoFor, shell, WishlistCard, wrap } from './shared.tsx';
import NotFound from './NotFound.tsx';

export default function FamilyDetail() {
  const { slug = '' } = useParams();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['family', slug], queryFn: () => api.family(slug), retry: false });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 5 * 60_000 });
  if (q.error instanceof ApiError && q.error.status === 404) return <NotFound />;
  const f = q.data;
  return (
    <div className={`${shell} anim-rise`}>
      <div className={wrap}>
        <BackButton to="/families">‹ All families</BackButton>
        {!f ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2"><Skeleton className="h-[440px] rounded-[32px]" /><div className="grid gap-3"><Skeleton className="h-40" /><Skeleton className="h-40" /></div></div>
        ) : (
          <div className="mt-5 grid items-start gap-5 md:grid-cols-2">
            <div className="grid gap-3.5">
              <FamilyArt art={art(f)} photoUrl={photoFor(f, settings.data?.showPhotos)} className="h-[440px] rounded-[32px]" alt="">
                <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1.5 text-[12px] font-semibold">{f.waitLabel}</span>
              </FamilyArt>
              <div className="rounded-xl3 bg-ink p-7 text-bg">
                <div className="text-[12px] font-semibold uppercase tracking-[.1em] text-lav">{f.city} · {f.familyId}</div>
                <h1 className="mt-2 text-[clamp(34px,4vw,52px)] font-extrabold leading-none tracking-[-.045em] text-white">{f.nickname}</h1>
                <div className="mt-3.5 flex flex-wrap gap-1.5">{f.children.map((k) => <KidChip key={k.name + k.age} k={k} dark />)}</div>
                {f.story && <p className="mt-5 text-[17px] leading-[1.5] text-bg/85">“{f.story}”</p>}
                <div className="mt-[18px] flex flex-wrap gap-1.5">{needChips(f).map((n) => <span key={n.label} className="rounded-full bg-lav px-[11px] py-1.5 text-[12px] font-semibold text-ink">{n.label}</span>)}</div>
                {f.status === 'Available' ? (
                  <div className="mt-[26px] flex flex-wrap gap-2">
                    <button onClick={() => { api.claimStart(slug).catch(() => {}); nav(`/families/${slug}/claim`); }} className="h-[54px] min-w-[180px] flex-1 rounded-full bg-lav text-base font-bold text-ink transition-colors hover:bg-white">Bless this family</button>
                    {settings.data?.chipInsEnabled && <Link to={`/families/${slug}/chip-in`} className="inline-flex h-[54px] items-center rounded-full border border-white/30 px-5 text-[15px] font-semibold text-white hover:bg-white/10">Chip in</Link>}
                  </div>
                ) : (
                  <div className="mt-[26px] rounded-[18px] bg-white/8 p-4 text-[14px] leading-[1.5] text-bg/85">
                    <b className="text-white">{f.status === 'Fulfilled' ? 'This family has been blessed.' : 'Someone has already claimed this family.'}</b> Thank you for looking — there are other households still waiting. <Link to="/families" className="font-semibold text-lav">See who's left →</Link>
                    {settings.data?.chipInsEnabled && f.status === 'Claimed' && <div className="mt-3"><Link to={`/families/${slug}/chip-in`} className="inline-flex h-10 items-center rounded-full border border-white/30 px-4 text-[13px] font-semibold text-white">Chip in toward their list</Link></div>}
                  </div>
                )}
              </div>
            </div>
            <div>
              <h2 className="text-[26px] tracking-[-.04em]">The wishlists</h2>
              <div className="mt-1 text-[13px] text-ink-3">{settings.data?.perChildBudgetNote ?? 'Most sponsors spend $75–$150 per child. Every item under $100.'}</div>
              <div className="mt-4 grid gap-3">{f.children.map((k, i) => <WishlistCard key={k.name + i} k={k} n={i + 1} />)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
