import { SPONSORSHIP_STEPS, stepIndex, type SponsorshipStatus } from '@bless/shared';
import { cx } from '@/lib/format';

/**
 * The dominoes tracker, as drawn in v3: a vertical list of numbered discs joined
 * by a line that fills purple as steps complete. `compact` renders the 6-dot pill
 * row used in admin tables.
 */
export function Dominoes({ status, compact, dates, deadlineLabel, handoffLabel }: { status: SponsorshipStatus; compact?: boolean; dates?: Partial<Record<SponsorshipStatus, string | null>>; deadlineLabel?: string; handoffLabel?: string }) {
  const idx = status === 'Released' ? -1 : stepIndex(status);
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1" aria-label={`Step ${idx + 1} of ${SPONSORSHIP_STEPS.length}`} title={status}>
        {SPONSORSHIP_STEPS.map((s, j) => (
          <span key={s.status} className={cx('inline-block h-2 rounded-full transition-all duration-300', j <= idx ? 'bg-pri' : 'bg-line', j === idx ? 'w-[18px]' : 'w-2')} />
        ))}
      </span>
    );
  }
  return (
    <ol aria-label="Sponsorship progress">
      {SPONSORSHIP_STEPS.map((s, i) => {
        const done = i <= idx;
        const current = i === idx;
        const last = i === SPONSORSHIP_STEPS.length - 1;
        const sub = s.status === 'Dropped Off' && deadlineLabel ? `${handoffLabel ?? 'Dropped off or delivered'} · by ${deadlineLabel}` : s.sub;
        return (
          <li key={s.status} className={cx('relative flex items-start gap-3.5', !last && 'pb-5')}>
            {!last && (
              <div className="absolute bottom-0 left-[17px] top-9 w-0.5 bg-line" aria-hidden>
                <div className="h-full origin-top bg-pri transition-transform duration-600 ease-[cubic-bezier(.16,1,.3,1)]" style={{ transform: `scaleY(${i < idx ? 1 : 0})` }} />
              </div>
            )}
            <div className={cx('relative z-10 grid size-9 flex-none place-items-center rounded-full border-2 text-[13px] font-bold transition-all duration-400', done ? 'border-pri bg-pri text-white' : 'border-line bg-white text-ink-3')} style={{ boxShadow: current ? '0 0 0 6px rgba(108,34,221,.15)' : 'none' }}>
              {done && !current ? '✓' : i + 1}
            </div>
            <div className="pt-1.5">
              <div className={cx('text-[15px] font-bold', done ? 'text-ink' : 'text-ink-3')}>{s.label}</div>
              <div className="mt-px text-[12px] text-ink-3">
                {dates?.[s.status] ? new Date(dates[s.status]!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' : ''}{sub}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
