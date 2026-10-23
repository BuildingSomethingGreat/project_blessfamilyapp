import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { animate, motion, useInView } from 'motion/react';
import { api } from '@/lib/api';
import { Button, Page } from '@/components/ui';
import { stagger, rise } from '@/components/ui/Page';
import { fmtDate } from '@/lib/format';
import { FamilyCard, FamilyCardSkeleton } from './FamilyCard.tsx';

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const ctrl = animate(0, to, { duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => { if (ref.current) ref.current.textContent = String(Math.round(v)); } });
    return () => ctrl.stop();
  }, [inView, to]);
  return <span ref={ref} className="tabular-nums">0</span>;
}

function Faq({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 py-4 text-left text-[17px] font-semibold">
        {q}
        <motion.span animate={{ rotate: open ? 45 : 0 }} className="grid size-7 shrink-0 place-items-center rounded-full bg-cream-2 text-ink-2"><svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 4v12M4 10h12" strokeLinecap="round" /></svg></motion.span>
      </button>
      <motion.div initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
        <p className="pb-5 text-[15px] leading-relaxed text-ink-2">{a}</p>
      </motion.div>
    </div>
  );
}

export default function Landing() {
  const { data: catalog, isLoading } = useQuery({ queryKey: ['catalog'], queryFn: api.catalog });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const preview = (catalog?.families ?? []).slice(0, 3);
  const deadline = settings ? fmtDate(settings.dropoffDeadline, { month: 'long', day: 'numeric' }) : '…';

  return (
    <Page className="pb-16">
      {/* Hero */}
      <section className="pt-10 sm:pt-20">
        <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-3xl">
          <motion.p variants={rise} className="text-sm font-semibold uppercase tracking-wider text-ember">The Konnection · Holiday {settings?.season ?? ''}</motion.p>
          <motion.h1 variants={rise} className="display-tight mt-4 text-[44px] leading-[0.98] sm:text-7xl lg:text-8xl">
            Bless a <span className="text-ember">whole family</span> this holiday.
          </motion.h1>
          <motion.p variants={rise} className="mt-6 max-w-xl text-lg text-ink-2 sm:text-xl">
            Families in our community share exactly what their kids need. You pick one, shop their wishlist, and drop the gifts with us. We handle the rest.
          </motion.p>
          <motion.div variants={rise} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/families"><Button size="xl" full>Find a family</Button></Link>
            <Link to="/register"><Button size="xl" variant="secondary" full>Register my family</Button></Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Live strip */}
      <section className="mt-12 grid grid-cols-3 gap-2 rounded-xl3 bg-ink p-4 text-cream sm:mt-16 sm:gap-4 sm:p-8">
        {[
          { label: 'families waiting', n: catalog?.counts.available ?? 0, tone: 'text-gold' },
          { label: 'claimed so far', n: catalog?.counts.claimed ?? 0, tone: 'text-cream' },
          { label: 'delivered', n: catalog?.counts.fulfilled ?? 0, tone: 'text-cream' },
        ].map((s) => (
          <div key={s.label} className="text-center sm:text-left">
            <div className={`display text-4xl sm:text-6xl ${s.tone}`}><CountUp to={s.n} /></div>
            <div className="mt-1 text-xs text-cream/70 sm:text-sm">{s.label}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="mt-16 sm:mt-24">
        <h2 className="display-tight text-3xl sm:text-5xl">How it works</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { n: '01', t: 'Pick a family', d: 'Browse families by size, ages and needs. Every one was referred through The Konnection and reviewed by our team.' },
            { n: '02', t: 'Shop their wishlist', d: 'You get a private page with every child\'s sizes, favorite color and wishes. Shop wherever you like.' },
            { n: '03', t: `Drop off by ${deadline}`, d: `Bring gifts to ${settings?.dropoffLocation ?? 'The Konnection'}. We deliver to the family and tell you when it lands.` },
          ].map((s, i) => (
            <motion.div key={s.n} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay: i * 0.08 }} className="rounded-xl3 border border-line/70 bg-paper p-6 shadow-soft">
              <div className="display text-sm font-bold text-ember">{s.n}</div>
              <h3 className="mt-3 text-2xl">{s.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.d}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center rounded-xl3 bg-pine-soft p-6">
          <div>
            <h3 className="text-xl text-pine">For families</h3>
            <p className="mt-1 text-[15px] text-ink-2">If you're part of The Konnection and your household could use a hand this season, the application takes about 10 minutes on your phone. Only children under 18 living in your home, one application per household.</p>
          </div>
          <Link to="/register"><Button variant="pine" size="lg">Start the application</Button></Link>
        </div>
      </section>

      {/* Preview cards */}
      <section className="mt-16 sm:mt-24">
        <div className="flex items-end justify-between">
          <h2 className="display-tight text-3xl sm:text-5xl">Waiting right now</h2>
          <Link to="/families" className="text-sm font-semibold text-ember underline-offset-2 hover:underline">See all {catalog?.counts.available ?? ''}</Link>
        </div>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }} className="mt-6 grid gap-5 sm:grid-cols-3">
          {isLoading ? Array.from({ length: 3 }).map((_, i) => <FamilyCardSkeleton key={i} />) : preview.map((f, i) => <FamilyCard key={f.slug} f={f} index={i} />)}
        </motion.div>
        {!isLoading && preview.length === 0 && <p className="mt-4 text-ink-3">Every family has been claimed. Thank you.</p>}
      </section>

      {/* General fund */}
      <section className="mt-16 rounded-xl3 border border-line/70 bg-paper p-6 shadow-soft sm:mt-24 sm:p-10">
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl">Can't take on a whole family?</h2>
            <p className="mt-2 max-w-xl text-[15px] text-ink-2">Groups often split one household between coworkers or a small group. Or give to The Konnection's general fund and we'll fill the gaps for families nobody picked.</p>
          </div>
          <a href={settings?.orgDonateUrl ?? 'https://thekonnection.org'} target="_blank" rel="noreferrer"><Button variant="dark" size="lg">Give to the general fund</Button></a>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-16 max-w-2xl sm:mt-24">
        <h2 className="display-tight text-3xl sm:text-5xl">Good questions</h2>
        <div className="mt-6">
          <Faq q="Who can sponsor a family?" a="Anyone. Individuals, families, churches, teams at work. You don't need to be part of The Konnection. Many groups split one household between several people." />
          <Faq q="What does it cost?" a={settings?.perChildBudgetNote ?? 'Most sponsors spend $75–$150 per child.'} />
          <Faq q="Where and when do I drop off?" a={`${settings?.dropoffLocation ?? 'The Konnection office'}, ${settings?.dropoffHours ?? ''}. Deadline is ${deadline}. Please don't wrap individual gifts; a bag per child with the child's first name is perfect.`} />
          <Faq q="How are families chosen?" a="Families are part of The Konnection's programs and apply themselves. Staff review every application for eligibility (children under 18 living in the home, one application per household) before it's listed." />
          <Faq q="Is the family's information private?" a="Yes. The public page shows first names, ages, sizes and wishes only. No last names, addresses, phone numbers or photos. Sponsors never receive a family's address; we deliver." />
        </div>
      </section>
    </Page>
  );
}
