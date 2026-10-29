import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClaimRequestSchema } from '@bless/shared';
import { api, ApiError, setSponsorToken } from '@/lib/api';
import { Checkbox } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { useAccount } from '@/lib/account';
import { BackButton, shell } from './shared.tsx';

const input = 'mt-1.5 h-[50px] w-full rounded-2xl border border-line bg-bg px-4 text-[15px] outline-none focus:border-pri focus:bg-white';

export default function Claim() {
  const { slug = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const fam = useQuery({ queryKey: ['family', slug], queryFn: () => api.family(slug), retry: false });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 5 * 60_000 });
  const [form, setForm] = useState({ name: '', phone: '', email: '', organization: '', note: '', wallOptIn: true, displayName: '', agree: false, emailConsent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  // Signed-in sponsors start from their account details. They can still change anything, e.g. to
  // sponsor on behalf of another group or pick a different hand-off.
  const { me } = useAccount();
  const prefilled = useRef(false);
  useEffect(() => {
    if (!me || prefilled.current) return;
    prefilled.current = true;
    const p = me.sponsor;
    setForm((f) => ({
      ...f,
      name: f.name || p.name, email: f.email || p.email, phone: f.phone || p.phone || '', organization: f.organization || p.organization || '',
      wallOptIn: p.wallOptIn || f.wallOptIn, displayName: f.displayName || p.displayName || '', emailConsent: true,
    }));
  }, [me]);
  const valid = form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && form.agree && form.emailConsent;
  const s = settings.data;
  const f = fam.data;

  const submit = async () => {
    const parsed = ClaimRequestSchema.safeParse(form);
    if (!parsed.success) { const e: Record<string, string> = {}; for (const i of parsed.error.issues) e[String(i.path[0])] = i.message; setErrors(e); return; }
    setBusy(true); setErrors({});
    try {
      const res = await api.claim(slug, parsed.data);
      setSponsorToken(res.token);
      qc.invalidateQueries({ queryKey: ['account'] });
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
            {me && prefilled.current && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-soft px-4 py-3.5 text-[13px] leading-[1.5] text-ink-2">
                <span aria-hidden className="mt-px grid size-6 flex-none place-items-center rounded-full bg-pri text-[12px] font-bold text-white">{(me.sponsor.name.trim()[0] ?? '♥').toUpperCase()}</span>
                <span><b className="text-ink">Welcome back, {me.sponsor.name.trim().split(/\s+/)[0]}.</b> We filled in your details. Sponsoring for another person or group, or handing off differently this time? Just change anything below.</span>
              </div>
            )}
            <div className="mt-6 grid gap-3">
              <label className="block"><span className="text-[13px] font-semibold text-ink-2">Your name</span><input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="First and last name" autoComplete="name" className={input} />{errors.name && <span className="mt-1 block text-[13px] text-bad">{errors.name}</span>}</label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="text-[13px] font-semibold text-ink-2">Email</span><input value={form.email} onChange={(e) => set('email', e.target.value)} type="email" placeholder="you@example.com" className={input} />{errors.email && <span className="mt-1 block text-[13px] text-bad">{errors.email}</span>}</label>
                <label className="block"><span className="text-[13px] font-semibold text-ink-2">Phone <span className="font-normal text-ink-3">(optional)</span></span><input value={form.phone} onChange={(e) => set('phone', e.target.value)} type="tel" placeholder="(313) 555-0100" className={input} />{errors.phone && <span className="mt-1 block text-[13px] text-bad">{errors.phone}</span>}</label>
              </div>
              <label className="block"><span className="text-[13px] font-semibold text-ink-2">Organization <span className="font-normal text-ink-3">(optional)</span></span><input value={form.organization} onChange={(e) => set('organization', e.target.value)} placeholder="Church, company, friend group" className={input} /></label>
            </div>
            {/* All gifts come through The Konnection. Staff switch a sponsorship to direct delivery only for Konnectors they know. */}
            <div className="mt-5 rounded-2xl bg-soft px-4 py-3.5 text-[13px] leading-[1.55] text-ink-2">
              <div className="text-[14px] font-semibold text-ink">How gifts reach the family</div>
              <p className="mt-1">Drop off your wrapped and labeled gifts at <b className="text-ink">{s?.dropoffLocation ?? 'Durfee Elementary-Middle School'}</b> by <b className="text-ink">{s ? fmtDate(s.dropoffDeadline, { month: 'long', day: 'numeric' }) : '…'}</b> ({s?.dropoffHours ?? 'Monday–Friday, 10 a.m.–6 p.m.'}), and we’ll deliver them to your adopted family. We’ll send friendly reminders along the way!</p>
              <p className="mt-2">Label every gift with the child's name, and include a gift receipt for each clothing item in case it doesn't fit.</p>
            </div>
            <p className="mt-2 px-1 text-[12px] leading-[1.5] text-ink-3">Already know this family personally? Email {s?.contactName || 'our team'} at <a href={`mailto:${s?.contactEmail ?? 'sharnese@thekonnection.org'}`} className="font-semibold text-ink-2">{s?.contactEmail ?? 'sharnese@thekonnection.org'}</a> after choosing them and we can arrange for you to deliver.</p>
            <div className="mt-4 rounded-2xl border border-line px-4 py-3.5">
              <Checkbox checked={form.wallOptIn} onChange={(v) => set('wallOptIn', v)}>Thank me on the Wall of Holiday Konnectors once my gifts are in.</Checkbox>
              {form.wallOptIn && <input value={form.displayName} onChange={(e) => set('displayName', e.target.value.slice(0, 80))} placeholder={`Show my name as… (e.g. ${form.organization || 'The Carter Family'})`} aria-label="Name to show on the wall" className="mt-2.5 h-11 w-full rounded-xl border border-line bg-bg px-3.5 text-[14px] outline-none focus:border-pri focus:bg-white" />}
              <div className="mt-1.5 text-[12px] text-ink-3">Leave it blank and we'll use your first name and last initial. You can change this anytime.</div>
            </div>
            <div className="mt-4"><Checkbox checked={form.emailConsent} onChange={(v) => set('emailConsent', v)}>I understand updates and reminders will come by email{form.email ? <> to <b className="text-ink">{form.email}</b></> : ''}. We only call if there's a delivery question.</Checkbox>{errors.emailConsent && <span className="mt-1 block text-[13px] text-bad">{errors.emailConsent}</span>}</div>
            <div className="mt-2.5"><Checkbox checked={form.agree} onChange={(v) => set('agree', v)}>I can support every child in this family, with the same number of gifts for each child.</Checkbox>{errors.agree && <span className="mt-1 block text-[13px] text-bad">{errors.agree}</span>}</div>
            {errors.form && <p className="mt-3 text-[13px] text-bad">{errors.form}</p>}
            <button onClick={submit} disabled={!valid || busy} className="mt-[22px] h-[54px] w-full rounded-full bg-pri text-base font-bold text-white transition-colors hover:bg-pri-dark disabled:bg-disabled">{busy ? 'Saving your family…' : 'Bless this family'}</button>
            <p className="mt-3 text-center text-[12px] leading-[1.5] text-ink-3">By choosing this family you agree to our <Link to="/legal#terms" className="font-semibold text-ink-2 underline-offset-2 hover:underline">Terms</Link> and <Link to="/legal#privacy" className="font-semibold text-ink-2 underline-offset-2 hover:underline">Privacy Policy</Link>.</p>
          </>
        )}
      </div>
    </div>
  );
}
