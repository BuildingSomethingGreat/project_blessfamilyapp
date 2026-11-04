import { giftQuestionsFor, type GiftDetails } from '@bless/shared';
import { cx } from '@/lib/format';

const split = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/**
 * The short follow-up questions for a child's chosen "Fun gifts" (which game system, which store…).
 * Used on the family application and in the admin family editor. Multi-choice answers are stored
 * comma-separated, matching how they are written to Airtable.
 */
export function GiftFollowUps({ giftTypes, value, onChange, showMissing, compact }: {
  giftTypes: readonly string[];
  value: GiftDetails;
  onChange: (next: GiftDetails) => void;
  /** Highlight required questions that are still empty. */
  showMissing?: boolean;
  compact?: boolean;
}) {
  const questions = giftQuestionsFor(giftTypes);
  if (!questions.length) return null;
  const set = (id: string, v: string) => onChange({ ...value, [id]: v });
  const groups = [...new Set(questions.map((q) => q.gift))];
  const chip = (on: boolean) => cx('rounded-full border font-semibold transition-colors', compact ? 'h-8 px-3 text-[12px]' : 'h-10 px-3.5 text-[14px]', on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink-3');

  return (
    <div className={cx('grid', compact ? 'gap-3' : 'gap-4')}>
      {groups.map((gift) => (
        <div key={gift} className={cx('rounded-[18px] border border-line bg-white', compact ? 'p-3' : 'p-4')}>
          <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-pri">{gift}</div>
          <div className={cx('grid', compact ? 'mt-2 gap-2.5' : 'mt-2.5 gap-3')}>
            {questions.filter((q) => q.gift === gift).map((q) => {
              const v = value[q.id] ?? '';
              const missing = showMissing && q.required && !v.trim();
              return (
                <div key={q.id}>
                  <div className={cx('font-semibold', compact ? 'text-[13px]' : 'text-[14px]', missing ? 'text-bad' : 'text-ink-2')}>
                    {q.label}{!q.required && <span className="font-normal text-ink-3"> (optional)</span>}
                  </div>
                  {q.kind === 'text' ? (
                    <input value={v} onChange={(e) => set(q.id, e.target.value.slice(0, 200))} placeholder={q.placeholder} aria-label={`${gift}: ${q.label}`}
                      className={cx('mt-1.5 w-full rounded-[12px] border bg-bg px-3 outline-none focus:border-pri focus:bg-white', compact ? 'h-9 text-[13px]' : 'h-11 text-[15px]', missing ? 'border-bad' : 'border-line')} />
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={`${gift}: ${q.label}`}>
                      {q.options!.map((o) => {
                        const picked = split(v);
                        const on = picked.includes(o);
                        const next = q.kind === 'single' ? (on ? '' : o) : (on ? picked.filter((x) => x !== o) : [...picked, o]).join(', ');
                        return <button key={o} type="button" aria-pressed={on} onClick={() => set(q.id, next)} className={chip(on)}>{o}</button>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
