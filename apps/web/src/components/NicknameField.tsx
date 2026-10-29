import { useRef } from 'react';
import { deriveNickname, nicknameProblem, type Child } from '@bless/shared';
import { cx } from '@/lib/format';

type Source = Pick<Child, 'giftTypes' | 'hobbies'>;

/**
 * Public family nickname with a "Shuffle" for new suggestions and a live privacy check
 * (no last names, no parent name, no long numbers). Used on the family application and in admin.
 */
export function NicknameField({ value, onChange, kids, seed, priv, size = 'lg', id = 'nickname', autoFocus }: {
  value: string;
  onChange: (v: string) => void;
  kids: Source[];
  seed: string;
  priv: { guardianName?: string; childNames?: string[] };
  size?: 'lg' | 'sm';
  id?: string;
  autoFocus?: boolean;
}) {
  const turn = useRef(0);
  const shuffle = () => {
    // Step through variants, skipping any that repeat the current name.
    for (let i = 0; i < 12; i++) {
      turn.current += 1;
      const next = deriveNickname(kids, seed, turn.current);
      if (next !== value) { onChange(next); return; }
    }
  };
  const problem = value.trim() ? nicknameProblem(value, priv) : null;
  const lg = size === 'lg';
  return (
    <div>
      <div className="flex gap-2">
        <input id={id} value={value} autoFocus={autoFocus} maxLength={40} onChange={(e) => onChange(e.target.value)} aria-invalid={!!problem} aria-describedby={`${id}-hint`}
          className={cx('min-w-0 flex-1 rounded-2xl border bg-bg px-4 font-bold tracking-[-.02em] outline-none focus:bg-white', lg ? 'h-[58px] text-[20px]' : 'h-11 text-[16px]', problem ? 'border-bad focus:border-bad' : 'border-line focus:border-pri')} />
        <button type="button" onClick={shuffle} className={cx('flex-none rounded-full border border-line bg-white font-semibold text-ink transition-colors hover:border-ink', lg ? 'h-[58px] px-5 text-[14px]' : 'h-11 px-3.5 text-[13px]')} aria-label="Suggest another nickname">
          <span aria-hidden className="mr-1.5">↻</span>Shuffle
        </button>
      </div>
      <div id={`${id}-hint`} className={cx('mt-1.5 text-[12px] leading-[1.5]', problem ? 'text-bad' : 'text-ink-3')}>
        {problem ?? "Holiday Konnectors see this. Please don't use your last name."}
      </div>
    </div>
  );
}
