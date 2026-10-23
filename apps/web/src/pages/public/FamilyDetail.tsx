import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { api, ApiError } from '@/lib/api';
import { Button, Chip, FamilyArt, Page, Skeleton, useToast } from '@/components/ui';
import { stagger, rise } from '@/components/ui/Page';
import { plural, fmtDate } from '@/lib/format';
import { ChildWishlist } from './ChildWishlist.tsx';
import { ClaimSheet } from './ClaimSheet.tsx';

export default function FamilyDetail() {
  const { slug = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const { data: f, isLoading, error } = useQuery({ queryKey: ['family', slug], queryFn: () => api.family(slug), retry: false });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.settings });

  useEffect(() => { if (open) api.claimStart(slug).catch(() => {}); }, [open, slug]);

  const share = async () => {
    const url = window.location.href;
    const title = f ? `${f.nickname} · Bless-A-Family` : 'Bless-A-Family';
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); toast('Link copied', 'ok'); }
    } catch { /* cancelled */ }
  };

  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <Page className="py-20 text-center">
        <h1 className="text-4xl">{notFound ? "We couldn't find that family" : 'Something went wrong'}</h1>
        <p className="mt-3 text-ink-2">{notFound ? 'The link may be old, or the family is no longer listed.' : 'Please try again in a moment.'}</p>
        <Link to="/families" className="mt-6 inline-block"><Button size="lg">Back to families</Button></Link>
      </Page>
    );
  }

  if (isLoading || !f) {
    return (
      <Page className="py-6">
        <Skeleton className="aspect-[4/3] w-full rounded-xl3 sm:aspect-[21/9]" />
        <Skeleton className="mt-6 h-10 w-2/3" />
        <Skeleton className="mt-3 h-5 w-1/3" />
        <Skeleton className="mt-8 h-64 w-full" />
      </Page>
    );
  }

  const seed = [...f.slug].reduce((a, c) => a + c.charCodeAt(0), 0);
  const available = f.status === 'Available';

  return (
    <Page className="pb-32 pt-4 sm:pt-6">
      <div className="relative overflow-hidden rounded-xl3 shadow-soft">
        <FamilyArt colors={f.colors} seed={seed} className="aspect-[4/3] sm:aspect-[21/9]" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
        <div className="absolute left-3 right-3 top-3 flex items-center justify-between sm:left-5 sm:right-5 sm:top-5">
          <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/families'))} aria-label="Back" className="grid size-10 place-items-center rounded-full bg-paper/90 text-ink shadow-soft backdrop-blur hover:bg-paper">
            <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4 6 10l6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button onClick={share} aria-label="Share" className="grid size-10 place-items-center rounded-full bg-paper/90 text-ink shadow-soft backdrop-blur hover:bg-paper">
            <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12V3M6.5 6.5 10 3l3.5 3.5M4 11v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5" /></svg>
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5 text-cream sm:p-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
              <span className="rounded-full bg-paper/20 px-2.5 py-1 backdrop-blur">{f.city}</span>
              <span className="rounded-full bg-paper/20 px-2.5 py-1 backdrop-blur">{f.childCount === 1 ? '1 child' : `${f.childCount} kids`} · ages {f.ageRange[0] === f.ageRange[1] ? f.ageRange[0] : `${f.ageRange[0]}–${f.ageRange[1]}`}</span>
              {available && <span className="rounded-full bg-paper/20 px-2.5 py-1 backdrop-blur">Waiting {plural(f.daysWaiting, 'day')}</span>}
            </div>
            <h1 className="display-tight mt-3 text-4xl sm:text-6xl">{f.nickname}</h1>
          </motion.div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {f.tags.map((t) => <Chip key={t} tone={t.startsWith('Needs') ? 'ember' : 'neutral'}>{t}</Chip>)}
      </div>

      {!available && (
        <div className="mt-6 rounded-xl3 border border-line bg-paper p-6 text-center shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-pine">{f.status === 'Fulfilled' ? 'Delivered' : 'Claimed'}</p>
          <h2 className="mt-2 text-2xl">This family has been {f.status === 'Fulfilled' ? 'blessed' : 'claimed'}.</h2>
          <p className="mt-2 text-ink-2">A sponsor already stepped up for {f.nickname}. There are other families still waiting.</p>
          <Link to="/families" className="mt-5 inline-block"><Button size="lg">See families waiting</Button></Link>
        </div>
      )}

      {f.story && (
        <figure className="mt-8 border-l-4 border-ember pl-5 sm:pl-6">
          <blockquote className="display text-2xl font-semibold leading-snug text-ink sm:text-3xl" style={{ letterSpacing: '-0.02em' }}>“{f.story}”</blockquote>
          <figcaption className="mt-2 text-sm text-ink-3">In their own words. Shared with permission.</figcaption>
        </figure>
      )}

      <div className="mt-10 flex items-end justify-between">
        <h2 className="text-2xl sm:text-3xl">The wishlists</h2>
        <span className="text-sm text-ink-3">{settings?.perChildBudgetNote}</span>
      </div>
      <motion.div variants={stagger} initial="hidden" animate="show" className="mt-4 grid gap-4 lg:grid-cols-2">
        {f.children.map((c, i) => (
          <motion.div key={c.name + i} variants={rise}><ChildWishlist c={c} index={i} /></motion.div>
        ))}
      </motion.div>

      {settings && (
        <div className="mt-8 rounded-xl3 bg-ink p-6 text-cream sm:p-8">
          <h3 className="text-xl text-cream">How it works once you claim</h3>
          <ol className="mt-4 grid gap-4 text-[15px] sm:grid-cols-3">
            <li><span className="font-semibold text-gold">1.</span> We email you a private family page with every size and wish.</li>
            <li><span className="font-semibold text-gold">2.</span> Shop at your pace. Tap one button when you've started so we don't have to check in.</li>
            <li><span className="font-semibold text-gold">3.</span> Drop gifts at {settings.dropoffLocation} by {fmtDate(settings.dropoffDeadline, { month: 'long', day: 'numeric' })}. We deliver to the family.</li>
          </ol>
        </div>
      )}

      {available && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-4 sm:bottom-6">
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.2 }} className="mx-auto flex max-w-xl items-center gap-3 rounded-full border border-line/70 bg-paper/95 p-2 pl-5 shadow-lift backdrop-blur">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{f.nickname}</div>
              <div className="truncate text-xs text-ink-3">{f.children.map((c) => c.name).join(', ')}</div>
            </div>
            <Button size="lg" onClick={() => setOpen(true)}>Bless this family · {f.childCount === 1 ? '1 kid' : `${f.childCount} kids`}</Button>
          </motion.div>
        </div>
      )}

      <ClaimSheet open={open} onClose={() => setOpen(false)} family={f} settings={settings} />
    </Page>
  );
}
