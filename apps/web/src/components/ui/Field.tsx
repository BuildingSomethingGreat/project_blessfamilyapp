import { forwardRef } from 'react';
import { cx } from '@/lib/format';

const base = 'w-full rounded-2xl border bg-paper px-4 py-3.5 text-[16px] text-ink placeholder:text-ink-3/70 transition-colors duration-200 focus:outline-none focus:border-ink';

export function Label({ children, hint, htmlFor }: { children: React.ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink-2">
      {children}
      {hint && <span className="ml-1 font-normal text-ink-3">{hint}</span>}
    </label>
  );
}
export function Error({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-sm text-bad" role="alert">{children}</p>;
}
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { error?: string }>(function Input({ className, error, ...rest }, ref) {
  return (
    <>
      <input ref={ref} className={cx(base, error ? 'border-bad' : 'border-line', className)} aria-invalid={!!error} {...rest} />
      <Error>{error}</Error>
    </>
  );
});
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }>(function Textarea({ className, error, ...rest }, ref) {
  return (
    <>
      <textarea ref={ref} className={cx(base, 'min-h-28 resize-y', error ? 'border-bad' : 'border-line', className)} aria-invalid={!!error} {...rest} />
      <Error>{error}</Error>
    </>
  );
});
export function Select({ className, error, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <>
      <div className="relative">
        <select className={cx(base, 'appearance-none pr-10', error ? 'border-bad' : 'border-line', className)} aria-invalid={!!error} {...rest}>
          {children}
        </select>
        <svg className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <Error>{error}</Error>
    </>
  );
}
/** Big tappable option — the heart of the typeform-style flow. */
export function Option({ selected, onClick, children, multi, className }: { selected: boolean; onClick: () => void; children: React.ReactNode; multi?: boolean; className?: string }) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        'group flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-[16px] font-medium transition-all duration-200 active:scale-[0.99]',
        selected ? 'border-ink bg-ink text-cream shadow-soft' : 'border-line bg-paper text-ink hover:border-ink-3', className,
      )}
    >
      <span className={cx('grid size-5 shrink-0 place-items-center rounded-full border transition-colors', multi && 'rounded-md', selected ? 'border-cream bg-cream' : 'border-ink-3/50 group-hover:border-ink')}>
        {selected && <svg viewBox="0 0 12 12" className="size-3 text-ink" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2.5 6.5 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <span className="flex-1">{children}</span>
    </button>
  );
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-3">
      <span className={cx('relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200', checked ? 'bg-pine' : 'bg-line')}>
        <span className={cx('absolute size-5 rounded-full bg-paper shadow transition-transform duration-200', checked ? 'translate-x-6' : 'translate-x-1')} />
      </span>
      {label && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}
