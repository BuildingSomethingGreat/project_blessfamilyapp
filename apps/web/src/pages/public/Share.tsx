import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QUOTE_ROLES, QuoteSubmitSchema, type QuoteRole } from '@bless/shared';
import { api, ApiError } from '@/lib/api';
import { Checkbox, Seg } from '@/components/ui';
import { cx } from '@/lib/format';
import { shell } from './shared.tsx';

const input = 'mt-1.5 h-[48px] w-full rounded-2xl border border-line bg-bg px-4 text-[15px] outline-none focus:border-pri focus:bg-white';

/**
 * Collects a short testimonial. Everything lands as Pending; staff approve it in
 * Admin → Community before it can appear on the home page.
 */
export function ShareForm({ token = '', compact, defaults }: { token?: string; compact?: boolean; defaults?: { name?: string; role?: QuoteRole } }) {
  const [form, setForm] = useState({ role: defaults?.role ?? ('Holiday Konnector' as QuoteRole), name: defaults?.name ?? '', organization: '', quote: '', email: '', consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const konnector = form.role === 'Holiday Konnector';

  const submit = async () => {
    const parsed = QuoteSubmitSchema.safeParse({ ...form, token });
    if (!parsed.success) { const e: Record<string, string> = {}; for (const i of parsed.error.issues) e[String(i.path[0])] = i.message; setErrors(e); return; }
    setBusy(true); setErrors({});
    try { await api.submitQuote(parsed.data); setDone(true); }
    catch (err) { setErrors({ form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' }); }
    finally { setBusy(false); }
  };

  if (done) return <div className="anim-pop rounded-2xl bg-soft px-4 py-4 text-[14px] leading-[1.5] text-pri-dark"><b>Thank you.</b> Our team reads every note. If we feature yours, it will appear on the home page with the name you gave us.</div>;

  return (
    <div className="grid gap-3">
      {!token && (
        <div><span className="text-[13px] font-semibold text-ink-2">I am a…</span><div className="mt-2 flex gap-2">{QUOTE_ROLES.map((r) => <Seg key={r} grow active={form.role === r} onClick={() => set('role', r)}>{r}</Seg>)}</div></div>
      )}
      <label className="block"><span className="text-[13px] font-semibold text-ink-2">{konnector ? 'What was it like?' : 'What would you like to say?'}</span>
        <textarea value={form.quote} onChange={(e) => set('quote', e.target.value.slice(0, 600))} placeholder={konnector ? 'Shopping for the kids was the best part of our season…' : 'Thank you for making my kids feel so special…'} className={cx('mt-1.5 w-full resize-none rounded-2xl border border-line bg-bg px-4 py-3 text-[15px] leading-[1.5] outline-none focus:border-pri focus:bg-white', compact ? 'min-h-24' : 'min-h-32')} />
        <span className="mt-1 flex justify-between text-[12px] text-ink-3"><span>{errors.quote ?? 'A sentence or two is perfect.'}</span><span>{form.quote.length}/600</span></span>
      </label>
      <div className={cx('grid gap-3', !compact && 'sm:grid-cols-2')}>
        <label className="block"><span className="text-[13px] font-semibold text-ink-2">Credit me as</span><input value={form.name} onChange={(e) => set('name', e.target.value.slice(0, 80))} placeholder={konnector ? 'The Carter Family' : 'A Konnection mom'} className={input} />{errors.name && <span className="mt-1 block text-[13px] text-bad">{errors.name}</span>}</label>
        {konnector
          ? <label className="block"><span className="text-[13px] font-semibold text-ink-2">Organization <span className="font-normal text-ink-3">(optional)</span></span><input value={form.organization} onChange={(e) => set('organization', e.target.value.slice(0, 120))} placeholder="Church, company, team" className={input} /></label>
          : <label className="block"><span className="text-[13px] font-semibold text-ink-2">Email <span className="font-normal text-ink-3">(optional, private)</span></span><input value={form.email} onChange={(e) => set('email', e.target.value)} type="email" placeholder="So we can say thank you" className={input} />{errors.email && <span className="mt-1 block text-[13px] text-bad">{errors.email}</span>}</label>}
      </div>
      {!konnector && <p className="text-[12px] leading-[1.5] text-ink-3">For your family's privacy, please don't include last names, addresses or school names. A first name or "A Konnection mom" is perfect.</p>}
      <Checkbox checked={form.consent} onChange={(v) => set('consent', v)}>The Konnection may share my words and the name above on this site and in their outreach.</Checkbox>
      {errors.consent && <span className="text-[13px] text-bad">{errors.consent}</span>}
      {errors.form && <span className="text-[13px] text-bad">{errors.form}</span>}
      <button onClick={submit} disabled={busy || !form.consent || form.quote.trim().length < 12 || form.name.trim().length < 2} className="h-[50px] rounded-full bg-pri text-[15px] font-bold text-white transition-colors hover:bg-pri-dark disabled:bg-disabled">{busy ? 'Sending…' : 'Send to The Konnection'}</button>
    </div>
  );
}

export default function Share() {
  const [params] = useSearchParams();
  const token = params.get('k') ?? '';
  return (
    <div className={`${shell} anim-rise`}>
      <div className="mx-auto max-w-[600px] rounded-[32px] border border-line bg-white p-[clamp(24px,4vw,40px)]">
        <div className="text-[12px] font-semibold uppercase tracking-[.1em] text-pri">Share your story</div>
        <h1 className="mt-1.5 text-[clamp(30px,4vw,42px)] font-extrabold leading-[1.02] tracking-[-.045em]">Tell us how it felt.</h1>
        <p className="mt-3 text-[15px] leading-[1.55] text-ink-2">Whether you blessed a family or your family was blessed, a few words from you help the next Holiday Konnector say yes. Our team reads every note before anything is shared.</p>
        <div className="mt-6"><ShareForm token={token} defaults={token ? { role: 'Holiday Konnector' } : undefined} /></div>
        <div className="mt-6 text-center text-[13px] text-ink-3"><Link to="/" className="font-semibold text-ink">Back home</Link></div>
      </div>
    </div>
  );
}
