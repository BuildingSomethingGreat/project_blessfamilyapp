import { cx } from '@/lib/format';

export function Chip({ children, active, onClick, tone = 'neutral', className }: { children: React.ReactNode; active?: boolean; onClick?: () => void; tone?: 'neutral' | 'ember' | 'pine' | 'gold' | 'dark' | 'ok' | 'warn' | 'bad' | 'info'; className?: string }) {
  const tones: Record<string, string> = {
    neutral: 'bg-cream-2 text-ink-2', ember: 'bg-ember-soft text-ember-2', pine: 'bg-pine-soft text-pine', gold: 'bg-gold-soft text-[#8a5f10]', dark: 'bg-ink text-cream',
    ok: 'bg-green-50 text-ok', warn: 'bg-amber-50 text-warn', bad: 'bg-red-50 text-bad', info: 'bg-blue-50 text-info',
  };
  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium leading-none transition-all duration-200',
        onClick && 'cursor-pointer hover:-translate-y-px',
        active ? 'bg-ink text-cream shadow-soft' : tones[tone], className,
      )}
    >
      {children}
    </Comp>
  );
}
