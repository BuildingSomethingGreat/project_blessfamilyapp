import { cx } from '@/lib/format';

export type ChipTone = 'soft' | 'soft2' | 'dark' | 'lav' | 'white' | 'outline' | 'bad' | 'warn' | 'ok' | 'info' | 'neutral';

const tones: Record<ChipTone, string> = {
  soft: 'bg-soft text-pri-dark', soft2: 'bg-soft-2 text-pri-dark', dark: 'bg-ink text-white', lav: 'bg-lav text-ink', white: 'bg-white/92 text-ink',
  outline: 'bg-bg border border-line text-ink', bad: 'bg-bad-soft text-bad', warn: 'bg-amber-50 text-warn', ok: 'bg-emerald-50 text-ok', info: 'bg-blue-50 text-info', neutral: 'bg-soft-2 text-ink-2',
};

export function Chip({ children, active, onClick, tone = 'soft', size = 'md', className, title }: { children: React.ReactNode; active?: boolean; onClick?: () => void; tone?: ChipTone; size?: 'sm' | 'md' | 'lg'; className?: string; title?: string }) {
  const Comp = onClick ? 'button' : 'span';
  const sz = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : size === 'lg' ? 'px-3.5 py-2.5 text-[13px]' : 'px-3 py-[5px] text-[12px]';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      aria-pressed={onClick ? !!active : undefined}
      className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold leading-none transition-all duration-200', sz, onClick && 'cursor-pointer', active ? 'bg-ink text-white' : tones[tone], className)}
    >
      {children}
    </Comp>
  );
}

/** Small uppercase purple label used above headings everywhere in v3. */
export function Kicker({ children, className, light }: { children: React.ReactNode; className?: string; light?: boolean }) {
  return <div className={cx('text-[12px] font-semibold uppercase tracking-[.1em]', light ? 'text-lav' : 'text-pri', className)}>{children}</div>;
}

/** The "How it works" style section pill. */
export function SectionPill({ children }: { children: React.ReactNode }) {
  return <div className="caps inline-block rounded-full bg-soft-2 px-3.5 py-1.5 text-[13px] font-semibold tracking-[.04em] text-pri">{children}</div>;
}
