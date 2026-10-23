import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/format';

export function Logo({ dark, className }: { dark?: boolean; className?: string }) {
  return (
    <Link to="/" className={cx('inline-flex items-center gap-2 font-display text-[17px] font-800 tracking-tight', dark ? 'text-cream' : 'text-ink', className)} style={{ fontWeight: 800 }}>
      <span className="grid size-8 place-items-center rounded-xl bg-ember text-white">
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor"><path d="M12 20.5c-.3 0-.6-.1-.8-.3L6.4 15.8C4.6 14.2 3.5 12.9 3.5 11c0-2.1 1.6-3.7 3.7-3.7 1.2 0 2.3.6 3.1 1.5.8-.9 1.9-1.5 3.1-1.5 2.1 0 3.7 1.6 3.7 3.7 0 1.9-1.1 3.2-2.9 4.8l-4.8 4.4c-.2.2-.5.3-.8.3Z" /></svg>
      </span>
      <span>Bless-A-Family</span>
    </Link>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-2xl bg-cream-2', className)} />;
}

export function Progress({ value, className, tone = 'ember' }: { value: number; className?: string; tone?: 'ember' | 'pine' | 'ink' }) {
  const bg = { ember: 'bg-ember', pine: 'bg-pine', ink: 'bg-ink' }[tone];
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-line', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={cx('h-full rounded-full', bg)} initial={false} animate={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl3 border border-dashed border-line bg-paper/60 px-6 py-12 text-center">
      <h3 className="text-xl">{title}</h3>
      {body && <p className="mx-auto mt-2 max-w-sm text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Abstract "family art": a soft gradient built from the kids' favorite colors. No photos of minors, by design. */
export function FamilyArt({ colors, className, seed = 0 }: { colors: string[]; className?: string; seed?: number }) {
  const cs = colors.length ? colors : ['#eb6834'];
  const stops = cs.map((c, i) => `${c} ${Math.round((i / Math.max(1, cs.length - 1)) * 100)}%`).join(', ');
  const angle = 120 + (seed % 7) * 15;
  return (
    <div className={cx('relative overflow-hidden', className)} aria-hidden>
      <div className="absolute inset-0" style={{ background: `linear-gradient(${angle}deg, ${stops})` }} />
      <div className="absolute inset-0 opacity-60" style={{ background: 'radial-gradient(120% 80% at 80% 0%, rgba(255,255,255,.55), transparent 60%), radial-gradient(80% 60% at 0% 100%, rgba(21,19,15,.25), transparent 60%)' }} />
      <svg className="absolute inset-0 size-full opacity-[0.12] mix-blend-overlay" aria-hidden><filter id={`n${seed}`}><feTurbulence baseFrequency="0.9" numOctaves="2" /></filter><rect width="100%" height="100%" filter={`url(#n${seed})`} /></svg>
    </div>
  );
}

export function Stat({ label, value, sub, tone, small }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'ember' | 'pine' | 'ink' | 'warn' | 'bad'; small?: boolean }) {
  const col = tone === 'ember' ? 'text-ember' : tone === 'pine' ? 'text-pine' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : 'text-ink';
  return (
    <div className="rounded-xl2 border border-line/70 bg-paper p-4 shadow-soft sm:p-5">
      <div className="text-[13px] font-medium text-ink-3">{label}</div>
      <div className={cx('display mt-1 tabular-nums leading-none', small ? 'text-3xl' : 'text-4xl sm:text-5xl', col)}>{value}</div>
      {sub && <div className="mt-2 text-[13px] text-ink-3">{sub}</div>}
    </div>
  );
}
