import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CARD_FEE, CHIP_IN_AMOUNTS } from '@bless/shared';
import { api, ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import { BackButton, shell } from './shared.tsx';

export default function ChipIn() {
  const { slug = '' } = useParams();
  const qc = useQueryClient();
  const fam = useQuery({ queryKey: ['family', slug], queryFn: () => api.family(slug), retry: false });
  const [amt, setAmt] = useState<number>(50);
  const [fees, setFees] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ total: number; url: string } | null>(null);
  const [error, setError] = useState('');
  const f = fam.data;
  const total = amt + (fees ? CARD_FEE : 0);
  const fmt = (n: number) => (n % 1 ? n.toFixed(2) : String(n));
  const pct = f ? Math.min(100, Math.round((f.raised / f.goal) * 100)) : 0;

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const res = await api.chipIn(slug, { amount: amt, coverFees: fees, name, email });
      if (res.checkoutUrl) window.open(res.checkoutUrl, '_blank', 'noopener');
      qc.invalidateQueries({ queryKey: ['family', slug] }); qc.invalidateQueries({ queryKey: ['catalog'] });
      setDone({ total: res.total, url: res.checkoutUrl });
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Something went wrong'); } finally { setBusy(false); }
  };

  return (
    <div className={`${shell} anim-rise`}>
      <div className="mx-auto max-w-[560px] rounded-[32px] border border-line bg-white p-[clamp(24px,4vw,40px)]">
        {done ? (
          <div className="anim-pop py-5 text-center">
            <div className="mx-auto grid size-[84px] place-items-center rounded-full bg-pri text-[38px] text-white">✓</div>
            <h1 className="mt-5 text-[36px] font-extrabold tracking-[-.045em]">Thank you.</h1>
            <p className="mx-auto mt-2.5 max-w-[340px] text-[15px] leading-[1.5] text-ink-2">${fmt(done.total)} goes toward {f?.nickname}'s wishlist. Konnection staff shop whatever a sponsor doesn't cover; we'll email you when it's delivered.</p>
            {done.url && <p className="mt-3 text-[13px] text-ink-3">Checkout opened in a new tab. <a href={done.url} target="_blank" rel="noreferrer" className="font-semibold text-pri">Open it again</a> if it was blocked.</p>}
            <Link to="/families" className="mt-[26px] inline-flex h-[50px] items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-white">Back to families</Link>
          </div>
        ) : (
          <>
            <BackButton to={`/families/${slug}`}>‹ Back</BackButton>
            <div className="mt-[22px] text-[12px] font-semibold uppercase tracking-[.1em] text-pri">Can't take a whole family?</div>
            <h1 className="mt-1.5 text-[clamp(30px,4vw,40px)] font-extrabold leading-[1.02] tracking-[-.045em]">Chip in for {f?.nickname ?? '…'}.</h1>
            <div className="mt-5"><div className="flex justify-between text-[13px] font-semibold"><span className="text-pri">${f?.raised ?? 0} so far</span><span className="text-ink-3">${f?.goal ?? 0} wishlist</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-pri transition-[width] duration-500" style={{ width: `${pct}%` }} /></div></div>
            <div className="mt-[22px] grid grid-cols-3 gap-2">
              {CHIP_IN_AMOUNTS.map((v) => <button key={v} onClick={() => setAmt(v)} className={cx('h-[58px] rounded-2xl border text-lg font-bold transition-all', amt === v ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink-3')}>${v}</button>)}
            </div>
            <label className="mt-4 flex items-center gap-2.5 text-[13px] text-ink-2"><input type="checkbox" checked={fees} onChange={(e) => setFees(e.target.checked)} className="size-[18px] accent-pri" />Add ${CARD_FEE.toFixed(2)} to cover the card fee</label>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="h-11 rounded-2xl border border-line bg-bg px-4 text-[14px] outline-none focus:border-pri focus:bg-white" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email for your receipt (optional)" className="h-11 rounded-2xl border border-line bg-bg px-4 text-[14px] outline-none focus:border-pri focus:bg-white" />
            </div>
            {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
            <button onClick={submit} disabled={busy || !f} className="mt-[22px] h-[54px] w-full rounded-full bg-pri text-base font-bold text-white transition-colors hover:bg-pri-dark disabled:bg-disabled">{busy ? 'One sec…' : `Chip in $${fmt(total)}`}</button>
            <div className="mt-2.5 text-center text-[11px] text-ink-3">Card checkout opens in a new tab. Tax receipt by email.</div>
          </>
        )}
      </div>
    </div>
  );
}
