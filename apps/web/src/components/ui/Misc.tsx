import { motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/format';

export function Logo({ className, to = '/', light }: { className?: string; to?: string; light?: boolean }) {
  return (
    <Link to={to} className={cx('inline-flex items-center gap-2.5 no-underline', light ? 'text-white' : 'text-ink', className)}>
      <img src="/brand/konnection-logo.png" alt="The Konnection" className="block h-[30px] w-auto" />
      <span className={cx('h-[18px] w-px', light ? 'bg-white/30' : 'bg-line')} />
      <span className="text-[14px] font-semibold">Bless-A-Family</span>
    </Link>
  );
}
/** Square "K" mark used in the questionnaire and admin sidebar. */
export function KMark({ size = 30, className }: { size?: number; className?: string }) {
  return <div className={cx('grid place-items-center rounded-[10px] bg-pri font-extrabold text-white', className)} style={{ width: size, height: size, fontSize: size * 0.47 }}>K</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-2xl bg-soft-2', className)} />;
}

export function Progress({ value, className, tone = 'pri', track = 'bg-soft' }: { value: number; className?: string; tone?: 'pri' | 'lav' | 'ink'; track?: string }) {
  const bg = { pri: 'bg-pri', lav: 'bg-lav', ink: 'bg-ink' }[tone];
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full', track, className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={cx('h-full rounded-full', bg)} initial={false} animate={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
    </div>
  );
}

export function EmptyState({ title, body, action, className }: { title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-xl3 border border-dashed border-line bg-white px-6 py-10 text-center', className)}>
      <div className="font-bold">{title}</div>
      {body && <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Family art: the approved photo when there is one, else the two-color gradient from the kids' favorite colors. */
export function FamilyArt({ art, photoUrl, className, children, alt = '' }: { art: string; photoUrl?: string; className?: string; children?: React.ReactNode; alt?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={cx('relative overflow-hidden', className)} style={{ background: art }}>
      {photoUrl && !broken && <img src={photoUrl} alt={alt} loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 size-full object-cover" />}
      {children}
    </div>
  );
}

/** Photo with graceful gradient fallback (for Konnection photography on the landing page). */
export function Photo({ src, alt, className, position, fallback = 'linear-gradient(135deg,#c9b8ff,#6c22dd)' }: { src: string; alt: string; className?: string; /** CSS object-position, e.g. "50% 25%" to keep faces in a wide crop. */ position?: string; fallback?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={cx('relative overflow-hidden', className)} style={{ background: fallback }}>
      {!broken && <img src={src} alt={alt} onError={() => setBroken(true)} className="absolute inset-0 size-full object-cover" style={position ? { objectPosition: position } : undefined} />}
    </div>
  );
}

/** KPI tile per v3: white card, small label, 38px number, sub line. `tone='pri'` renders the purple hero tile. */
export function Stat({ label, value, sub, tone, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'pri' | 'ok' | 'warn' | 'bad' | 'dark'; className?: string }) {
  const filled = tone === 'pri' || tone === 'dark';
  const valueColor = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : '';
  return (
    <div className={cx('rounded-[22px] border border-line p-[18px]', tone === 'pri' ? 'bg-pri text-white' : tone === 'dark' ? 'bg-ink text-white' : 'bg-white text-ink', className)}>
      <div className={cx('text-[12px] font-semibold', filled ? 'opacity-70' : 'text-ink-3')}>{label}</div>
      <div className={cx('display mt-1.5 text-[38px] font-extrabold leading-[1.1] tracking-[-.04em] tabular', valueColor)}>{value}</div>
      {sub && <div className={cx('mt-1 text-[12px]', filled ? 'opacity-70' : 'text-ink-3')}>{sub}</div>}
    </div>
  );
}

/** Blurred purple orb used behind heroes and loaders. */
export function Orb({ className, color = '#c9b8ff', size = 380, opacity = 0.55, delay = '0s', reverse }: { className?: string; color?: string; size?: number; opacity?: number; delay?: string; reverse?: boolean }) {
  return <div aria-hidden className={cx('pointer-events-none absolute rounded-full drift', className)} style={{ width: size, height: size, background: color, filter: 'blur(90px)', opacity, animationDelay: delay, animationDirection: reverse ? 'reverse' : undefined }} />;
}
