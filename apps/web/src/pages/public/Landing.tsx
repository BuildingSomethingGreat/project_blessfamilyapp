import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { CommunityView } from '@bless/shared';
import { api, PHOTOS } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { ArrowButton, Orb, Photo, SectionPill } from '@/components/ui';
import { Bokeh, FESTIVE, Layer, Prop, Snow } from '@/components/festive';
import { cx } from '@/lib/format';

const HEADLINE = [['Give', 0], ['a', 1], ['family', 2], ['the', 3], ['holiday', 4], ["they've", 5, true], ['been', 6, true], ['hoping', 7, true], ['for.', 8, true]] as const;

export default function Landing() {
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 5 * 60_000 });
  const community = useQuery({ queryKey: ['community'], queryFn: api.community, staleTime: 60_000 });
  const latest = community.data?.wall[0];
  const contact = settings.data?.contactEmail ?? 'sharnese@thekonnection.org';
  const counts = catalog.data?.counts ?? { available: 0, claimed: 0, fulfilled: 0, kids: 0 };
  const blessed = counts.claimed + counts.fulfilled;
  const blessedPct = Math.round((blessed / Math.max(1, blessed + counts.available)) * 100);
  const deadline = settings.data?.dropoffDeadline ?? '';
  const daysLeft = deadline ? Math.max(0, Math.round((new Date(deadline + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000)) : null;
  const deadlineShort = deadline ? fmtDate(deadline, { month: 'short', day: 'numeric' }) : 'the deadline';
  const deadlineLong = deadline ? fmtDate(deadline, { weekday: 'long', month: 'long', day: 'numeric' }) : 'the deadline';
  const [faq, setFaq] = useState(0);
  const FAQ: [string, string][] = [
    ['What is a Holiday Konnector?', 'Anyone who chooses a Konnection family and shops their children’s wish lists: individuals, families, churches, teams and companies.'],
    ['Do I pay through this site?', 'No. Holiday Konnectors shop the wish lists themselves, then deliver the gifts to the family or drop them off with us. If you’d rather give money, you can chip in toward a family or give to the general fund.'],
    ['How much does it cost to sponsor a child?', 'How much you spend is entirely up to you! Sponsors typically spend $100–$250 per child. If you sponsor a family with multiple children, we ask that you purchase the same number of gifts for each child so every child feels equally celebrated.'],
    ["What if I can't follow through?", 'We understand that plans can change. If you’re unable to fulfill your sponsorship, please let us know at least 10 days before the gift deadline, whenever possible, so we have time to find another sponsor. Tap “I can no longer sponsor” on your family page to notify us and make the family available for another sponsor.'],
    ['Who are the families?', "Households already connected to The Konnection's programs. Every application is reviewed by staff before it appears here."],
    ['Can my company or church sponsor several families?', `Yes! Email ${contact} and we'll set aside a group of families for your team.`],
  ];
  const donate = settings.data?.orgDonateUrl ?? 'https://thekonnection.org';

  return (
    <div className="overflow-x-clip">
      {/* Opener: hero + image band share one festive stage so snow can fall behind and in front of both */}
      <div className="relative">
        <Layer className="z-0">
          <Bokeh count={30} seed={3} />
          {/* far back: an out-of-focus branch for depth; the sharp twin sits in the front layer */}
          <Prop src={FESTIVE.branch} flip blur={5} opacity={0.45} depth={-0.04} className="-right-[10%] -top-[4%] w-[clamp(260px,42vw,720px)]" />
          <Prop src={FESTIVE.branch} blur={6} opacity={0.35} depth={-0.05} className="-left-[12%] -top-[6%] w-[clamp(260px,40vw,680px)]" />
          {/* on small screens the branches stay behind the content so the headline and pill remain clear */}
          <Prop src={FESTIVE.branch} motion="sway" depth={0.02} opacity={0.95} className="-left-16 -top-10 w-[210px] md:-left-12 md:w-[260px] lg:hidden" />
          <Prop src={FESTIVE.branch} flip motion="sway" depth={0.02} opacity={0.95} delay="-3s" className="-right-10 -top-8 w-[180px] md:-right-8 md:w-[220px] lg:hidden" />
          <Prop src={FESTIVE.snowflake} motion="drift" blur={0.6} opacity={0.75} depth={-0.06} className="left-[4%] top-[38%] w-[clamp(34px,5vw,84px)] sm:left-[9%]" />
          <Prop src={FESTIVE.snowflake} motion="drift" blur={0.4} opacity={0.7} depth={-0.03} delay="-4s" className="right-[5%] top-[30%] w-[clamp(30px,4vw,64px)] sm:right-[10%] sm:top-[36%]" />
          <Snow layer="back" />
        </Layer>
      {/* Hero */}
      <section className="relative px-4 pt-[clamp(56px,8vw,104px)] text-center sm:px-8">
        <Orb className="left-[8%] top-[-40px] z-0" color="#c9b8ff" size={380} />
        <Orb className="right-[6%] top-[80px] z-0" color="#9b6bff" size={320} opacity={0.35} delay="-6s" reverse />
        <div className="relative z-10">
          <div className="anim-fade-up inline-flex items-center gap-2 rounded-full border border-line-2 bg-white/70 py-[5px] pl-[5px] pr-3.5 text-[13px] font-medium text-ink-2 backdrop-blur-[10px]">
            <span className="rounded-full bg-pri px-2.5 py-[3px] text-[12px] font-semibold text-white">Holiday {settings.data?.season ?? ''}</span>
            <span className="size-[7px] rounded-full bg-pri pulse-dot" />
            <span>{counts.available} families are waiting</span>
          </div>
          <h1 className="mx-auto mt-5 flex max-w-[1000px] flex-wrap justify-center gap-x-[.24em] text-[clamp(44px,7.4vw,96px)] font-bold leading-none tracking-[-.05em]">
            {HEADLINE.map(([w, i, pri]) => (
              <span key={i} className="word-clip"><span className={cx('word-in', pri && 'text-pri')} style={{ ['--d' as string]: `${0.15 + i * 0.07}s` }}>{w}</span></span>
            ))}
          </h1>
          <p className="anim-fade-up pretty mx-auto mt-5 max-w-[600px] text-[clamp(16px,1.4vw,19px)] leading-[1.55] text-ink-4" style={{ ['--d' as string]: '0.75s' }}>
            Choose a Konnection family and shop the children’s wish lists. Deliver your gifts directly to the family, or drop them off with us and we’ll handle delivery. We’ll guide you every step of the way.
          </p>
          <div className="anim-fade-up mt-8 flex flex-wrap justify-center gap-2.5" style={{ ['--d' as string]: '0.9s' }}>
            <Link to="/families"><ArrowButton>Find a family</ArrowButton></Link>
            <Link to="/register" className="inline-flex h-[54px] items-center rounded-full border border-[#e1d9ef] bg-white/70 px-6 text-base font-semibold text-ink backdrop-blur-[10px] transition-colors hover:border-ink">Register my family</Link>
          </div>
          <div className="anim-fade-up mt-7 flex items-center justify-center gap-3 text-[13px] text-ink-4" style={{ ['--d' as string]: '1.05s' }}>
            <div className="flex">{['#c9b8ff', '#9b6bff', '#6c22dd', '#1d1133'].map((c, i) => <span key={c} className="inline-block size-8 rounded-full border-2 border-bg" style={{ background: c, marginLeft: i ? -10 : 0 }} />)}</div>
            <span><b className="text-ink">{blessed} families</b> already blessed this season</span>
          </div>
        </div>
      </section>

      {/* Image band with floating stats */}
      <section className="anim-fade-up px-4 pt-[clamp(48px,6vw,72px)] sm:px-8" style={{ ['--d' as string]: '1.15s' }}>
        <div className="relative mx-auto max-w-[1180px]">
          <div className="band-in relative h-[clamp(340px,46vw,580px)] overflow-hidden rounded-[36px] bg-lav">
            <div className="parallax-img absolute inset-0"><Photo src={PHOTOS.hero} alt="Konnection youth" className="size-full" /></div>
            <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(29,17,51,.35), rgba(29,17,51,0) 45%)' }} />
          </div>
          <div className="float-a pointer-events-none absolute bottom-[clamp(12px,3vw,32px)] left-[clamp(12px,3vw,32px)] w-[min(270px,44%)]">
            <div className="rounded-[24px] border border-white/60 bg-white/78 px-5 py-[18px] shadow-lift backdrop-blur-[18px]">
              <div className="text-[12px] font-medium text-ink-4">Families waiting</div>
              <div className="mt-1 flex items-baseline gap-2"><span className="text-[40px] font-bold leading-none tracking-[-.04em]">{counts.available}</span>{daysLeft !== null && <span className="rounded-full bg-soft-2 px-2 py-[3px] text-[12px] font-semibold text-pri">{daysLeft} days left</span>}</div>
              <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-pri/12"><div className="h-full rounded-full bg-pri origin-left" style={{ width: `${blessedPct}%`, animation: 'grow 1.4s cubic-bezier(.16,1,.3,1) both', animationDelay: 'calc(var(--hd) + 1.4s)' }} /></div>
              <div className="mt-1.5 text-[11px] text-ink-4">{blessedPct}% of the season matched</div>
            </div>
          </div>
          {latest && (
            <div className="float-b pointer-events-none absolute bottom-[clamp(12px,3vw,32px)] right-[clamp(12px,3vw,32px)] max-w-[46%]">
              <div className="flex items-center gap-3 rounded-[24px] border border-white/12 bg-ink/72 py-3.5 pl-3.5 pr-[18px] text-white shadow-lift backdrop-blur-[18px]">
                <span className="grid size-[38px] flex-none place-items-center rounded-full bg-lav font-bold text-ink">✓</span>
                <div className="min-w-0"><div className="text-[13px] font-semibold">Thank you, Holiday Konnector</div><div className="truncate text-[11px] opacity-70">{latest.name} · {latest.kids} {latest.kids === 1 ? 'child' : 'kids'} blessed · {timeAgo(latest.latestAt)}</div></div>
              </div>
            </div>
          )}
          {/* props overlapping the band's top corners (in front of the photo, behind nothing interactive) */}
          <Prop src={FESTIVE.gifts} motion="hover" depth={0.06} className="z-20 -left-1 -top-[clamp(52px,7vw,112px)] w-[clamp(92px,13vw,214px)] sm:-left-6" />
          <Prop src={FESTIVE.lantern} motion="hover" delay="-3s" depth={0.1} className="z-20 -right-1 -top-[clamp(64px,9vw,150px)] w-[clamp(54px,7vw,122px)] sm:-right-5" />
        </div>
      </section>
        <Layer className="z-20">
          <Prop src={FESTIVE.branch} motion="sway" depth={0.05} className="hidden lg:block lg:-left-12 lg:-top-20 lg:w-[clamp(260px,24vw,440px)]" />
          <Prop src={FESTIVE.ornament} motion="swing" depth={0.08} className="hidden xl:block left-[clamp(40px,7vw,150px)] top-[clamp(120px,13vw,250px)] w-[clamp(56px,6.5vw,118px)]" />
          <Prop src={FESTIVE.branch} flip motion="sway" depth={0.03} delay="-3s" className="hidden lg:block lg:-right-8 lg:-top-14 lg:w-[clamp(230px,22vw,380px)]" />
        </Layer>
        <Snow layer="front" className="z-30" />
      </div>

      {/* Partners marquee */}
      <PartnersMarquee />

      {/* How it works */}
      <section className="relative px-4 pt-[clamp(80px,10vw,140px)] sm:px-8">
        <Prop src={FESTIVE.snowflake} motion="drift" opacity={0.6} depth={-0.03} className="right-[3%] top-[12%] hidden w-[clamp(40px,5vw,76px)] md:block" />
        <Prop src={FESTIVE.ornament} motion="swing" depth={0.04} className="left-[2%] -top-10 hidden w-[clamp(56px,6vw,96px)] lg:block xl:left-[4%]" />
        <div className="mx-auto max-w-[1180px]">
          <div className="reveal text-center"><SectionPill>How it works</SectionPill><h2 className="balance mt-4 text-[clamp(34px,4.6vw,60px)] leading-[1.05] tracking-[-.045em]">Three steps. We handle the rest.</h2></div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <HowCard n="01" title="Choose a family" body="Browse Konnection families. First names, ages, sizes, and a short story written by the parent.">
              <div className="flex h-[220px] items-center justify-center gap-2.5 overflow-hidden rounded-[22px] bg-soft-2">
                <MiniCard tilt={-8} shift={18} color="#c9b8ff" />
                <MiniCard tilt={4} color="#6c22dd" front />
              </div>
            </HowCard>
            <HowCard n="02" title="Shop the wish lists" body="Your private family page keeps every size handy. Same number of gifts for each child, wrapped and labeled with their name." late>
              <div className="flex h-[220px] flex-col justify-center gap-2 rounded-[22px] bg-soft-2 p-[22px]">
                <Row label={<><b>Winter coat</b> · wrapped, receipt in</>} done />
                <Row label={<><b>Sketchbook</b> · labeled “Maya”</>} done />
                <Row label={<><b>Boots</b> · Toddler 11</>} />
              </div>
            </HowCard>
            <HowCard n="03" title={`Hand off by ${deadlineShort}`} body={`Deliver directly to the family, or drop off at ${settings.data?.dropoffLocation ?? 'our drop-off site'} and we deliver. Friendly reminders along the way.`} dark late>
              <div className="flex h-[220px] flex-col justify-center gap-2.5 rounded-[22px] bg-white/6 p-[22px]">
                <div className="max-w-[85%] self-start rounded-[16px_16px_16px_4px] bg-white px-3 py-2.5 text-[12px] leading-[1.45] text-ink">12 days to go! Wrap each gift and label it with the child's name. Thank you, Holiday Konnector!</div>
                <div className="self-end rounded-[16px_16px_4px_16px] bg-lav px-3 py-2.5 text-[12px] font-semibold text-ink">Gifts handed off ✓</div>
              </div>
            </HowCard>
          </div>
        </div>
      </section>

      {/* Why it matters */}
      <section className="relative px-4 pt-[clamp(80px,10vw,140px)] sm:px-8">
        <Prop src={FESTIVE.gifts} motion="hover" depth={0.03} blur={1.5} opacity={0.8} className="left-[1%] bottom-[-40px] hidden w-[clamp(120px,12vw,190px)] lg:block" />
        <Prop src={FESTIVE.snowflake} motion="drift" opacity={0.5} blur={1} depth={-0.04} delay="-2s" className="right-[6%] top-[4%] hidden w-[56px] md:block" />
        <div className="mx-auto grid max-w-[1180px] items-stretch gap-4 md:grid-cols-2">
          <CampaignCollage />
          <div className="reveal-late flex flex-col justify-center p-[clamp(8px,2vw,24px)]">
            <div><SectionPill>Why it matters</SectionPill></div>
            <h2 className="balance mt-4 text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-.045em]">Every child deserves to feel seen, loved, and celebrated.</h2>
            <p className="mt-4 max-w-[520px] text-base leading-[1.6] text-ink-4">The Konnection helps Detroit youth stay connected to school through mentoring, essential resources and unforgettable experiences. Bless This Family brings that care home for the holidays. These are a few of the kids our Holiday Konnectors blessed last season.</p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <BigStat value="700+" label="youth impacted" />
              <BigStat value="4,000+" label="resources distributed" />
              <BigStat value={String(counts.kids)} label="kids on this year's list" pri />
            </div>
          </div>
        </div>
      </section>

      {/* Quotes from Holiday Konnectors and families (approved by staff), then the wall of names */}
      <Voices data={community.data} />
      <KonnectorWall data={community.data} />

      {/* FAQ */}
      <section className="px-4 pt-[clamp(80px,10vw,140px)] sm:px-8">
        <div className="mx-auto grid max-w-[1180px] items-start gap-8 md:grid-cols-2">
          <div className="reveal"><SectionPill>FAQ</SectionPill><h2 className="mt-4 text-[clamp(32px,4vw,52px)] leading-[1.05] tracking-[-.045em]">Questions, answered.</h2><p className="mt-3.5 max-w-[380px] text-[15px] leading-[1.6] text-ink-4">Still unsure? Email <a className="text-pri hover:text-ink" href={`mailto:${contact}`}>{contact}</a> and a real person will reply.</p></div>
          <div className="reveal-late grid gap-2.5">
            {FAQ.map(([q, a], i) => (
              <div key={q} className="overflow-hidden rounded-[22px] border border-line-2 bg-white transition-shadow hover:shadow-lift">
                <button onClick={() => setFaq(faq === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 px-[22px] py-5 text-left text-base font-semibold" aria-expanded={faq === i}>
                  <span>{q}</span>
                  <span className={cx('grid size-[30px] flex-none place-items-center rounded-full text-lg transition-all duration-300', faq === i ? 'rotate-45 bg-pri text-white' : 'bg-soft text-pri-dark')}>+</span>
                </button>
                {faq === i && <div className="anim-fade-up px-[22px] pb-5 text-[15px] leading-[1.6] text-ink-4" style={{ animationDuration: '.4s' }}>{a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + footer */}
      <section className="px-4 pb-24 pt-[clamp(80px,10vw,140px)] sm:px-8 sm:pb-6">
        <div className="reveal relative mx-auto max-w-[1180px] overflow-hidden rounded-[40px] bg-ink px-[clamp(24px,5vw,72px)] py-[clamp(48px,7vw,96px)] text-white">
          <Orb className="bottom-[-160px] right-[-120px]" color="#6c22dd" size={480} opacity={0.65} />
          <Orb className="left-[-100px] top-[-140px]" color="#c9b8ff" size={360} opacity={0.25} delay="-8s" reverse />
          <Bokeh count={22} seed={11} edges={false} className="opacity-70" />
          <Prop src={FESTIVE.branch} flip motion="sway" className="-right-12 -top-14 w-[clamp(200px,30vw,420px)]" />
          <Prop src={FESTIVE.gifts} motion="hover" delay="-2s" className="bottom-[-18px] right-[clamp(16px,8vw,120px)] hidden w-[clamp(120px,14vw,200px)] md:block" />
          <div className="relative max-w-[760px]">
            <h2 className="balance text-[clamp(36px,5.4vw,76px)] leading-none tracking-[-.05em] text-white">{counts.available} families are still waiting.</h2>
            <p className="mt-[18px] max-w-[520px] text-[17px] leading-[1.55] text-white/72">Gifts are due {deadlineLong}. Become a Holiday Konnector today. It takes two minutes.</p>
            <div className="mt-[30px] flex flex-wrap gap-2.5">
              <Link to="/families" className="inline-flex h-[54px] items-center rounded-full bg-white px-7 text-base font-semibold text-ink transition-colors hover:bg-lav">Find a family</Link>
              <a href={donate} target="_blank" rel="noreferrer" className="inline-flex h-[54px] items-center rounded-full border border-white/30 bg-white/6 px-6 text-base font-semibold text-white backdrop-blur-[10px]">Give to the general fund</a>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-7 flex max-w-[1180px] flex-wrap items-center justify-between gap-4 text-[13px] text-ink-3">
          <div className="flex items-center gap-3"><img src="/brand/konnection-logo.png" alt="The Konnection" className="h-[26px] w-auto" /><span>© {settings.data?.season ?? ''} The Konnection · Detroit, MI</span></div>
          <span>First names and ages only. Parent names, addresses and phone numbers are never published. <Link to="/admin" className="ml-2 text-ink-3/70 hover:text-ink">Admin</Link></span>
        </div>
      </section>
    </div>
  );
}

/**
 * Partner logos scroll in a seamless loop. Logos come from /partners/manifest.json
 * (populate with `pnpm --filter @bless/web partners:fetch`); until then the combined
 * strip from thekonnection.org is used.
 */
function PartnersMarquee() {
  const manifest = useQuery({ queryKey: ['partners'], queryFn: async () => (await fetch('/partners/manifest.json')).json() as Promise<{ logos: { src: string; alt: string }[] }>, staleTime: Infinity, retry: false });
  const logos = manifest.data?.logos?.length ? manifest.data.logos : [{ src: PHOTOS.partners, alt: 'Konnection partners' }];
  const row = [...logos, ...logos]; // duplicated so the -50% translate loops cleanly
  return (
    <section className="reveal pt-16 text-center">
      <div className="px-4 text-[13px] font-medium text-ink-3">The Konnection is powered by partners who take action</div>
      <div className="mt-[22px] overflow-hidden" style={{ maskImage: 'linear-gradient(90deg,transparent,#000 15%,#000 85%,transparent)', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 15%,#000 85%,transparent)' }}>
        <div className="marquee flex w-max items-center gap-16 opacity-70 grayscale" style={{ animationDuration: `${Math.max(20, row.length * 4)}s` }}>
          {row.map((l, i) => <img key={i} src={l.src} alt={i < logos.length ? l.alt : ''} className="block h-[56px] w-auto max-w-[220px] object-contain sm:h-[72px]" loading="lazy" />)}
        </div>
      </div>
    </section>
  );
}

function HowCard({ n, title, body, children, dark, late }: { n: string; title: string; body: string; children: React.ReactNode; dark?: boolean; late?: boolean }) {
  return (
    <div className={cx(late ? 'reveal-late' : 'reveal', 'flex flex-col rounded-[32px] p-3.5 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-lift', dark ? 'bg-ink text-white' : 'border border-line-2 bg-white')}>
      {children}
      <div className="px-3 pb-3 pt-5"><div className={cx('text-[13px] font-semibold', dark ? 'text-lav' : 'text-pri')}>{n}</div><h3 className={cx('mt-1.5 text-[22px]', dark && 'text-white')}>{title}</h3><p className={cx('mt-2 text-[15px] leading-[1.55]', dark ? 'text-white/70' : 'text-ink-4')}>{body}</p></div>
    </div>
  );
}
function MiniCard({ tilt, shift = 0, color, front }: { tilt: number; shift?: number; color: string; front?: boolean }) {
  return (
    <div className={cx('h-[150px] w-[110px] rounded-[18px] bg-white p-2.5 shadow-[0_16px_30px_-18px_rgba(29,17,51,.5)]', front && 'relative z-10')} style={{ transform: `rotate(${tilt}deg) translateX(${shift}px)` }}>
      <div className="h-[70px] rounded-[10px]" style={{ background: color }} /><div className="mt-2.5 h-2 w-[70%] rounded-full bg-line" /><div className="mt-1.5 h-2 w-[45%] rounded-full bg-line" />
    </div>
  );
}
function Row({ label, done }: { label: React.ReactNode; done?: boolean }) {
  return (
    <div className={cx('flex items-center justify-between rounded-[14px] bg-white px-3.5 py-3 text-[13px]', !done && 'opacity-60')}>
      <span>{label}</span>
      {done ? <span className="grid size-5 place-items-center rounded-full bg-pri text-[11px] text-white">✓</span> : <span className="size-5 rounded-full border-2 border-line" />}
    </div>
  );
}
function BigStat({ value, label, pri }: { value: string; label: string; pri?: boolean }) {
  return (
    <div className={cx('border-t-2 pt-3.5', pri ? 'border-pri' : 'border-ink')}>
      <div className={cx('text-[clamp(32px,3.4vw,44px)] font-bold leading-none tracking-[-.04em]', pri && 'text-pri')}>{value}</div>
      <div className="mt-1.5 text-[13px] text-ink-3">{label}</div>
    </div>
  );
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 14 ? `${d} days ago` : fmtDate(iso, { month: 'short', day: 'numeric' });
}

/** Last season's hand-out photos, as a staggered, slightly tilted collage. */
function CampaignCollage() {
  const [a, b, c, d] = PHOTOS.campaign;
  const tile = 'group relative overflow-hidden rounded-[26px] bg-lav shadow-[0_24px_48px_-28px_rgba(29,17,51,.55)] transition-transform duration-500 hover:z-10 hover:scale-[1.02]';
  const img = 'size-full transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.06]';
  return (
    <figure className="reveal relative grid grid-cols-2 gap-3 sm:gap-4">
      <div className="grid content-start gap-3 sm:gap-4">
        <div className={cx(tile, 'aspect-[3/4] -rotate-[1.5deg]')}><Photo src={a.src} alt={a.alt} className={img} /></div>
        <div className={cx(tile, 'aspect-square rotate-[1deg]')}><Photo src={c.src} alt={c.alt} className={img} /></div>
      </div>
      <div className="grid content-start gap-3 pt-10 sm:gap-4 sm:pt-16">
        <div className={cx(tile, 'aspect-square rotate-[1.5deg]')}><Photo src={b.src} alt={b.alt} className={img} /></div>
        <div className={cx(tile, 'aspect-[3/4] -rotate-[1deg]')}><Photo src={d.src} alt={d.alt} className={img} /></div>
      </div>
      <figcaption className="pointer-events-none absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/70 bg-white/88 px-4 py-2 text-[12px] font-semibold text-ink shadow-soft backdrop-blur-[10px]">
        <span className="mr-1.5 inline-block size-2 rounded-full bg-pri align-middle" />Bless This Family, last season
      </figcaption>
    </figure>
  );
}

/** Approved quotes from Holiday Konnectors and families. Hidden entirely until staff approve one. */
function Voices({ data }: { data?: CommunityView }) {
  const quotes = data?.quotes ?? [];
  if (!data) return null;
  if (!quotes.length) {
    return (
      <section className="px-4 pt-[clamp(80px,10vw,140px)] sm:px-8">
        <div className="reveal mx-auto flex max-w-[900px] flex-col items-center rounded-[32px] border border-dashed border-line bg-white/70 px-6 py-10 text-center backdrop-blur-[6px]">
          <SectionPill>In their words</SectionPill>
          <h2 className="balance mt-4 text-[clamp(26px,3vw,38px)] leading-[1.1] tracking-[-.04em]">Blessed a family, or been blessed? We'd love to hear it.</h2>
          <Link to="/share" className="mt-6 inline-flex h-[50px] items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-white transition-colors hover:bg-pri">Share your story</Link>
        </div>
      </section>
    );
  }
  const [lead, ...rest] = quotes;
  const words = lead.quote.split(' ');
  return (
    <section className="relative px-4 pt-[clamp(80px,10vw,140px)] sm:px-8">
      <Prop src={FESTIVE.lantern} motion="hover" depth={0.05} className="right-[4%] top-[18%] hidden w-[clamp(70px,7vw,120px)] lg:block" />
      <Prop src={FESTIVE.snowflake} motion="drift" opacity={0.55} depth={-0.03} delay="-6s" className="left-[6%] top-[10%] hidden w-[64px] lg:block" />
      <div className="mx-auto max-w-[900px] text-center" style={{ viewTimelineName: '--quote' } as React.CSSProperties}>
        <div className="reveal"><SectionPill>In their words</SectionPill></div>
        <blockquote className="balance mt-6 text-[clamp(24px,3vw,40px)] font-medium leading-[1.3] tracking-[-.03em]">
          “{words.map((w, i) => <span key={i}><span style={{ animation: 'ink linear both', animationTimeline: '--quote', animationRange: `cover ${10 + i * (40 / words.length)}% cover ${14 + i * (40 / words.length)}%` } as React.CSSProperties}>{w}</span>{i < words.length - 1 ? ' ' : ''}</span>)}”
        </blockquote>
        <div className="reveal mt-7 flex items-center justify-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-lav font-bold text-ink">{initials(lead.name)}</span><div className="text-left"><div className="text-[15px] font-semibold">{lead.name}</div><div className="text-[13px] text-ink-3">{lead.role}{lead.organization ? ` · ${lead.organization}` : ''}{lead.season ? ` · ${lead.season}` : ''}</div></div></div>
      </div>
      {rest.length > 0 && (
        <div className="mx-auto mt-12 grid max-w-[1180px] gap-3.5 md:grid-cols-3">
          {rest.slice(0, 3).map((q, i) => (
            <figure key={q.id} className={cx(i ? 'reveal-late' : 'reveal', 'rounded-[28px] border border-line-2 bg-white p-6')}>
              <blockquote className="text-[16px] leading-[1.55] text-ink-2">“{q.quote}”</blockquote>
              <figcaption className="mt-4 text-[13px]"><b className="text-ink">{q.name}</b><span className="text-ink-3"> · {q.role}</span></figcaption>
            </figure>
          ))}
        </div>
      )}
      <div className="mt-8 text-center text-[13px] text-ink-3">Were you part of it? <Link to="/share" className="font-semibold text-pri hover:text-ink">Share your story</Link></div>
    </section>
  );
}
const initials = (n: string) => n.replace(/^(the|a)\s+/i, '').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '♥';

/** Wall of Holiday Konnectors: opted-in names, shown once their gifts are handed off. */
function KonnectorWall({ data }: { data?: CommunityView }) {
  if (!data) return null;
  const { wall, totals } = data;
  return (
    <section className="px-4 pt-[clamp(80px,10vw,140px)] sm:px-8">
      <div className="reveal relative mx-auto max-w-[1180px] overflow-hidden rounded-[40px] bg-soft-2 px-[clamp(20px,5vw,64px)] py-[clamp(40px,6vw,72px)]">
        <Bokeh count={18} seed={21} edges={false} className="opacity-60" />
        <Prop src={FESTIVE.ornament} motion="swing" className="right-[clamp(16px,6vw,80px)] -top-3 hidden w-[clamp(48px,5vw,80px)] sm:block" />
        <div className="relative">
          <SectionPill>Wall of Holiday Konnectors</SectionPill>
          <h2 className="balance mt-4 max-w-[760px] text-[clamp(32px,4.4vw,56px)] leading-[1.02] tracking-[-.045em]">Thank you, Holiday Konnectors.</h2>
          <p className="mt-3 max-w-[620px] text-[16px] leading-[1.55] text-ink-4">
            {totals.familiesBlessed > 0
              ? <>This season, <b className="text-ink">{totals.konnectors} {totals.konnectors === 1 ? 'Konnector has' : 'Konnectors have'}</b> blessed <b className="text-ink">{totals.familiesBlessed} {totals.familiesBlessed === 1 ? 'family' : 'families'}</b> and <b className="text-ink">{totals.kidsBlessed} kids</b>. Names appear here once gifts are handed off.</>
              : <>Every Konnector who blesses a family can be thanked here by name once their gifts are handed off.</>}
          </p>
          {wall.length > 0 ? (
            <ul className="mt-8 flex flex-wrap gap-2.5">
              {wall.map((w, i) => (
                <li key={w.name} className="anim-pop flex items-center gap-2.5 rounded-full border border-white bg-white py-2 pl-2 pr-4 shadow-soft" style={{ animationDelay: `${Math.min(i, 20) * 40}ms` }}>
                  <span className="grid size-8 flex-none place-items-center rounded-full bg-pri text-[12px] font-bold text-white">{initials(w.name)}</span>
                  <span className="text-[14px] font-semibold">{w.name}</span>
                  <span className="text-[12px] text-ink-3">{w.families > 1 ? `${w.families} families` : `${w.kids} ${w.kids === 1 ? 'child' : 'kids'}`}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Link to="/families" className="mt-8 inline-flex h-[50px] items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-white transition-colors hover:bg-pri">Be the first name on the wall</Link>
          )}
        </div>
      </div>
    </section>
  );
}
