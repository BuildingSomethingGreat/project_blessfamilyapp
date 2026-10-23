import { forwardRef } from 'react';
import { cx } from '@/lib/format';

const base = 'w-full rounded-2xl border border-line bg-bg px-4 text-[15px] text-ink transition-colors duration-200 focus:border-pri focus:bg-white focus:outline-none';

export function Label({ children, hint, htmlFor, className }: { children: React.ReactNode; hint?: string; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cx('mb-1.5 block text-[13px] font-semibold text-ink-2', className)}>
      {children}
      {hint && <span className="ml-1 font-normal text-ink-3">{hint}</span>}
    </label>
  );
}
export function Error({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[13px] text-bad" role="alert">{children}</p>;
}
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { error?: string }>(function Input({ className, error, ...rest }, ref) {
  return (
    <>
      <input ref={ref} className={cx(base, 'h-[50px]', error && 'border-bad', className)} aria-invalid={!!error} {...rest} />
      <Error>{error}</Error>
    </>
  );
});
/** The typeform-style big underline input used for one-question screens. */
export const UnderlineInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { error?: string }>(function UnderlineInput({ className, error, ...rest }, ref) {
  return (
    <>
      <input ref={ref} className={cx('w-full border-0 border-b-2 border-line bg-transparent py-2.5 text-[26px] font-semibold tracking-[-.02em] text-ink outline-none transition-colors focus:border-pri sm:text-[28px]', error && 'border-bad', className)} aria-invalid={!!error} {...rest} />
      <Error>{error}</Error>
    </>
  );
});
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }>(function Textarea({ className, error, ...rest }, ref) {
  return (
    <>
      <textarea ref={ref} className={cx(base, 'min-h-28 resize-none rounded-[18px] py-3.5 leading-relaxed', error && 'border-bad', className)} aria-invalid={!!error} {...rest} />
      <Error>{error}</Error>
    </>
  );
});
export function Select({ className, error, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <>
      <div className="relative">
        <select className={cx(base, 'h-12 appearance-none rounded-[14px] pr-9', error && 'border-bad', className)} aria-invalid={!!error} {...rest}>
          {children}
        </select>
        <svg className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <Error>{error}</Error>
    </>
  );
}
/** v3 segmented pill: white with border, active = ink. */
export function Seg({ active, onClick, children, className, swatch, grow }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string; swatch?: string; grow?: boolean }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={cx('inline-flex h-[46px] items-center justify-center gap-2 rounded-full border px-4 text-[14px] font-semibold transition-all duration-200 active:scale-[.98]', active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink-3', grow && 'flex-1', className)}>
      {swatch && <span className="inline-block size-4 rounded-full border border-black/10" style={{ background: swatch }} />}
      {children}
    </button>
  );
}
/** Big tappable row option (multi/single lists). */
export function Option({ selected, onClick, children, multi, className }: { selected: boolean; onClick: () => void; children: React.ReactNode; multi?: boolean; className?: string }) {
  return (
    <button type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={selected} onClick={onClick}
      className={cx('group flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-[15px] font-medium transition-all duration-200 active:scale-[0.99]', selected ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink-3', className)}>
      <span className={cx('grid size-5 shrink-0 place-items-center rounded-full border transition-colors', multi && 'rounded-md', selected ? 'border-white bg-white' : 'border-ink-3/50 group-hover:border-ink')}>
        {selected && <svg viewBox="0 0 12 12" className="size-3 text-ink" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2.5 6.5 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <span className="flex-1">{children}</span>
    </button>
  );
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-3">
      <span className={cx('relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200', checked ? 'bg-pri' : 'bg-line')}>
        <span className={cx('absolute size-5 rounded-full bg-white shadow transition-transform duration-200', checked ? 'translate-x-6' : 'translate-x-1')} />
      </span>
      {label && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}
export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 text-[14px] leading-relaxed text-ink-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-pri" />
      <span>{children}</span>
    </label>
  );
}
