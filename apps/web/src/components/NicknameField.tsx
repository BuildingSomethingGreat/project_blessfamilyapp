import { nicknameProblem } from '@bless/shared';
import { cx } from '@/lib/format';

/**
 * Admin rename for a family's public name. Families are listed as "Bless-a-Family #N" by default;
 * staff can rename one, with a live privacy check (no last names, no parent name, no long numbers),
 * or reset it to the number.
 */
export function NicknameField({ value, onChange, defaultName, priv, size = 'lg', id = 'nickname', autoFocus }: {
  value: string;
  onChange: (v: string) => void;
  /** The numbered name, e.g. "Bless-a-Family #12". */
  defaultName: string;
  priv: { guardianName?: string; childNames?: string[] };
  size?: 'lg' | 'sm';
  id?: string;
  autoFocus?: boolean;
}) {
  const problem = value.trim() ? nicknameProblem(value, priv) : null;
  const lg = size === 'lg';
  return (
    <div>
      <div className="flex gap-2">
        <input id={id} value={value} autoFocus={autoFocus} maxLength={40} onChange={(e) => onChange(e.target.value)} aria-invalid={!!problem} aria-describedby={`${id}-hint`}
          className={cx('min-w-0 flex-1 rounded-2xl border bg-bg px-4 font-bold tracking-[-.02em] outline-none focus:bg-white', lg ? 'h-[58px] text-[20px]' : 'h-11 text-[16px]', problem ? 'border-bad focus:border-bad' : 'border-line focus:border-pri')} />
        {value !== defaultName && (
          <button type="button" onClick={() => onChange(defaultName)} className={cx('flex-none rounded-full border border-line bg-white font-semibold text-ink transition-colors hover:border-ink', lg ? 'h-[58px] px-5 text-[14px]' : 'h-11 px-3.5 text-[13px]')}>
            Use #{defaultName.split('#')[1] ?? ''}
          </button>
        )}
      </div>
      <div id={`${id}-hint`} className={cx('mt-1.5 text-[12px] leading-[1.5]', problem ? 'text-bad' : 'text-ink-3')}>
        {problem ?? 'Holiday Konnectors see this name. Never use a last name.'}
      </div>
    </div>
  );
}
