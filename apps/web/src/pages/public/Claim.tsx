import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClaimRequestSchema } from '@bless/shared';
import { api, ApiError, setSponsorToken } from '@/lib/api';
import { Checkbox, Seg } from '@/components/ui';
import type { Handoff } from '@bless/shared';
import { fmtDate } from '@/lib/format';
import { BackButton, shell } from './shared.tsx';

const input = 'mt-1.5 h-[50px] w-full rounded-2xl border border-line bg-bg px-4 text-[15px] outline-none focus:border-pri focus:bg-white';

export default function Claim() {
  const { slug = '' } = useParams();
  const nav = useNavigate();
  const fam = useQuery({ queryKey: ['family', slug], queryFn: () => api.family(slug), retry: false });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 5 * 60_000 });
  const [form, setForm] = useState({ name: '', phone: '', email: '', organization: '', preferredContact: 'Text' as 'Text' | 'Email', note: '', handoff: 'Drop off' as Handoff, wallOptIn: true, displayName: '', agree: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && form.agree;
  const s = settings.data;
  const f = fam.data;

  const submit = async () => {
    const parsed = ClaimRequestSchema.safeParse(form);
    if (!parsed.success) { const e: Record<string, string> = {}; for (const i of parsed.error.issues) e[String(i.path[0])] = i.message; setErrors(e); return; }
    setBusy(true); setErrors({});
    try {
      const res = await api.claim(slug, parsed.data);
      setSponsorToken(res.token);
      nav(`/s/${res.token}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setGone(err.message);
      else if (err instanceof ApiError && err.issues) { const e: Record<string, string> = {}; const fe = (err.issues as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {}; for (const [k, v] of Object.entries(fe)) e[k] = v[0]; setErrors(e); }
      else setErrors({ form: err instanceof Error ? err.message : 'Something went wrong' });
    } finally { setBusy(false); }
  };

  return (
    <div className={`${shell} anim-rise`}>
      <div className="mx-auto max-w-[560px] rounded-[32px] border border-line bg-white p-[clamp(24px,4vw,40px)]">
        {gone ? (
          <div className="text-center"><h1 className="text-[30px] font-extrabold tracking-[-.045em]">Someone beat you to it.</h1><p className="mt-3 text-[15px] leading-[1.5] text-ink-2">{gone}</p><Link to="/families" className="mt-6 inline-flex h-[50px] items-center rounded-full bg-pri px-6 font-semibold text-white">Back to families</Link></div>
        ) : (
          <>
            <BackButton to={`/families/${slug}`}>‹ Back</BackButton>
            <div className="mt-[22px] text-[12px] font-semibold uppercase tracking-[.1em] text-pri">Become a Holiday Konnector</div>
            <h1 className="mt-1.5 text-[clamp(30px,4vw,40px)] font-extrabold leading-[1.02] tracking-[-.045em]">You're blessing <span className="text-pri">{f?.nickname ?? '…'}</span>.</h1>
            <p className="mt-3 text-[15px] leading-[1.5] text-ink-2">{f ? `${f.kidLine}: ${f.kidNames}. ` : ''}No payment here. Tell us who you are and we'll send your private family page with every size and wish.</p>
            <div className="mt-6 grid gap-3">
              <label className="block"><span className="text-[13px] font-semibold text-ink-2">Your name</span><input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="First and last name" autoComplete="name" className={input} />{errors.name && <span className="mt-1 block text-[13px] text-bad">{errors.name}</span>}</label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="text-[13px] font-semibold text-ink-2">Email</span><input value={form.email} onChange={(e) => set('email', e.target.value)} type="email" placeholder="you@example.com" className={input} />{errors.email && <span className="mt-1 block text-[13px] text-bad">{errors.email}</span>}</label>
                <label className="block"><span className="text-[13px] font-semibold text-ink-2">Mobile <span className="font-normal text-ink-3">(optional)</span></span><input value={form.phone} onChange={(e) => set('phone', e.target.value)} type="tel" placeholder="(313) 555-0100" className={input} />{errors.phone && <span className="mt-1 block text-[13px] text-bad">{errors.phone}</span>}</label>
              </div>
              <label className="block"><span className="text-[13px] font-semibold text-ink-2">Organization <span className="font-normal text-ink-3">(optional)</span></span><input value={form.organization} onChange={(e) => set('organization', e.target.value)} placeholder="Church, company, friend group" className={input} /></label>
              <div><span className="text-[13px] font-semibold text-ink-2">How should we check in?</span><div className="mt-2 flex gap-2"><Seg grow active={form.preferredContact === 'Text'} onClick={() => set('preferredContact', 'Text')}>Text me</Seg><Seg grow active={form.preferredContact === 'Email'} onClick={() => set('preferredContact', 'Email')}>Email me</Seg></div></div>
            </div>
            <div className="mt-5"><span className="text-[13px] font-semibold text-ink-2">How will the gifts reach the family?</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([['Drop off', 'Drop off with us', `At ${s?.dropoffLocation ?? 'our drop-off site'}. We deliver to the family.`], ['Deliver directly', 'Deliver them myself', 'Our team connects you with the family privately.']] as const).map(([v, t, sub]) => (
                  <button key={v} type="button" onClick={() => set('handoff', v)} aria-pressed={form.handoff === v} className={`rounded-2xl border px-4 py-3 text-left transition-colors ${form.handoff === v ? 'border-pri bg-soft-2' : 'border-line bg-white hover:border-ink-3'}`}>
                    <div className="text-[14px] font-semibold">{form.handoff === v ? '● ' : '○ '}{t}</div><div className="mt-0.5 text-[12px] leading-[1.4] text-ink-3">{sub}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-[18px] rounded-2xl bg-soft px-4 py-3.5 text-[13px] leading-[1.55] text-ink-2">
              {form.handoff === 'Drop off'
                ? <>Please drop off gifts at <b className="text-ink">{s?.dropoffLocation ?? 'Durfee Elementary-Middle School'}</b> by <b className="text-ink">{s ? fmtDate(s.dropoffDeadline, { month: 'long', day: 'numeric' }) : '…'}</b>, during drop-off hours: {s?.dropoffHours ?? 'Monday–Friday, 10 a.m.–6 p.m.'}</>
                : <>Our team will reach out to arrange delivery to the family before <b className="text-ink">{s ? fmtDate(s.dropoffDeadline, { month: 'long', day: 'numeric' }) : '…'}</b>. The family's address stays private until then.</>}
              {' '}All gifts should be wrapped and individually labeled with the child's name. Please include a gift receipt for each clothing item in case it doesn't fit. We'll send friendly reminders along the way!
            </div>
            <div className="mt-4 rounded-2xl border border-line px-4 py-3.5">
              <Checkbox checked={form.wallOptIn} onChange={(v) => set('wallOptIn', v)}>Thank me on the Wall of Holiday Konnectors once my gifts are in.</Checkbox>
              {form.wallOptIn && <input value={form.displayName} onChange={(e) => set('displayName', e.target.value.slice(0, 80))} placeholder={`Show my name as… (e.g. ${form.organization || 'The Carter Family'})`} aria-label="Name to show on the wall" className="mt-2.5 h-11 w-full rounded-xl border border-line bg-bg px-3.5 text-[14px] outline-none focus:border-pri focus:bg-white" />}
              <div className="mt-1.5 text-[12px] text-ink-3">Leave it blank and we'll use your first name and last initial. You can change this anytime.</div>
            </div>
            <div className="mt-4"><Checkbox checked={form.agree} onChange={(v) => set('agree', v)}>I can support every child in this family, with the same number of gifts for each child.</Checkbox>{errors.agree && <span className="mt-1 block text-[13px] text-bad">{errors.agree}</span>}</div>
            {errors.form && <p className="mt-3 text-[13px] text-bad">{errors.form}</p>}
            <button onClick={submit} disabled={!valid || busy} className="mt-[22px] h-[54px] w-full rounded-full bg-pri text-base font-bold text-white transition-colors hover:bg-pri-dark disabled:bg-disabled">{busy ? 'Saving your family…' : 'Bless this family'}</button>
          </>
        )}
      </div>
    </div>
  );
}
