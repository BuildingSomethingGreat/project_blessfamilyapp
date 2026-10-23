import { motion } from 'motion/react';
import { SPONSORSHIP_STEPS, stepIndex, type SponsorshipStatus } from '@bless/shared';
import { cx } from '@/lib/format';

/** The dominoes tracker. Horizontal on wide screens, vertical on narrow. */
export function Dominoes({ status, compact, dates }: { status: SponsorshipStatus; compact?: boolean; dates?: Partial<Record<SponsorshipStatus, string | null>> }) {
  const idx = status === 'Released' ? -1 : stepIndex(status);
  return (
    <ol className={cx('relative', compact ? 'flex items-center gap-1' : 'grid gap-0 sm:grid-cols-5')} aria-label="Sponsorship progress">
      {SPONSORSHIP_STEPS.map((s, i) => {
        const done = i <= idx;
        const current = i === idx;
        if (compact) {
          return (
            <li key={s.status} className="flex items-center" title={s.label}>
              <motion.span initial={false} animate={{ scale: current ? 1.15 : 1 }} className={cx('block h-2 rounded-full transition-colors duration-500', done ? 'bg-pine' : 'bg-line', current ? 'w-5' : 'w-2')} />
            </li>
          );
        }
        return (
          <li key={s.status} className="relative flex items-start gap-3 py-3 sm:flex-col sm:items-center sm:gap-2 sm:py-0 sm:text-center">
            {i < SPONSORSHIP_STEPS.length - 1 && (
              <span className="absolute left-[15px] top-11 h-[calc(100%-1.25rem)] w-0.5 bg-line sm:left-1/2 sm:top-4 sm:h-0.5 sm:w-full" aria-hidden>
                <motion.span className="block h-full w-full origin-top bg-pine sm:origin-left" initial={false} animate={{ scaleY: i < idx ? 1 : 0, scaleX: i < idx ? 1 : 0 }} transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }} style={{ transformOrigin: 'top left' }} />
              </span>
            )}
            <motion.span
              initial={false}
              animate={done ? { backgroundColor: '#1e5a46', borderColor: '#1e5a46', color: '#fff' } : { backgroundColor: '#fffdf9', borderColor: '#e5dccd', color: '#7a756a' }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className={cx('relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold', current && 'ring-4 ring-pine/20')}
            >
              {done && !current ? (
                <motion.svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}>
                  <motion.path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />
                </motion.svg>
              ) : (
                i + 1
              )}
            </motion.span>
            <span className="min-w-0">
              <span className={cx('block text-sm font-semibold', done ? 'text-ink' : 'text-ink-3')}>{s.label}</span>
              {dates?.[s.status] && <span className="block text-xs text-ink-3">{new Date(dates[s.status]!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
