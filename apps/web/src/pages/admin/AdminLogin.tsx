import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { Button, Input, KMark, Kicker, Label } from '@/components/ui';

export default function AdminLogin() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const token = params.get('token');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'error'>(token ? 'verifying' : 'idle');
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let alive = true;
    api.admin.verify(token)
      .then(() => { if (alive) nav(loc.state?.from && loc.state.from !== '/admin/login' ? loc.state.from : '/admin', { replace: true }); })
      .catch((e) => { if (alive) { setError(e instanceof ApiError ? e.message : 'That link is invalid or expired.'); setState('error'); } });
    return () => { alive = false; };
  }, [token, nav, loc.state]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending'); setError('');
    try {
      const r = await api.admin.requestLink(email);
      setDevLink(r.devLink ?? null);
      setState('sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the link.');
      setState('error');
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="anim-rise w-full max-w-[440px] rounded-[32px] border border-line bg-white p-[clamp(24px,4vw,40px)]">
        <div className="flex items-center gap-2.5"><KMark size={32} /><div><div className="text-[14px] font-bold leading-[1.1]">Bless-A-Family</div><div className="text-[10px] font-semibold tracking-[.08em] text-ink-3">ADMIN</div></div></div>

        {state === 'verifying' && (
          <div className="mt-8 flex items-center gap-3 text-ink-2"><span className="size-5 animate-spin rounded-full border-2 border-ink border-t-transparent" /> Signing you in…</div>
        )}

        {state === 'sent' && (
          <div className="mt-7">
            <Kicker>Check your inbox</Kicker>
            <h1 className="mt-1.5 text-[30px] font-extrabold leading-[1.05] tracking-[-.045em]">Your link is on its way.</h1>
            <p className="mt-3 text-[15px] leading-[1.5] text-ink-2">If <b className="text-ink">{email}</b> is an admin, a sign-in link just went out. It works for 15 minutes.</p>
            {devLink && (
              <div className="mt-5 rounded-2xl bg-soft p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-pri-dark">Local development only</div>
                <p className="mt-1 text-[13px] text-ink-2">The console mailer is on, so here is the link directly.</p>
                <Button className="mt-3" size="sm" variant="dark" onClick={() => { window.location.href = devLink; }}>Open dev link</Button>
              </div>
            )}
            <button className="mt-6 text-[13px] font-semibold text-ink-3 hover:text-ink" onClick={() => setState('idle')}>Use a different email</button>
          </div>
        )}

        {(state === 'idle' || state === 'sending' || state === 'error') && (
          <form onSubmit={submit} className="mt-7">
            <Kicker>Staff sign-in</Kicker>
            <h1 className="mt-1.5 text-[30px] font-extrabold leading-[1.05] tracking-[-.045em]">We'll email you a one-tap link.</h1>
            <p className="mt-3 text-[15px] text-ink-2">No passwords. The link lands in your inbox.</p>
            <div className="mt-6">
              <Label htmlFor="email">Admin email</Label>
              <Input id="email" type="email" autoComplete="email" required placeholder="you@thekonnection.org" value={email} onChange={(e) => setEmail(e.target.value)} error={state === 'error' ? error : undefined} />
            </div>
            <Button type="submit" full size="xl" className="mt-5" loading={state === 'sending'}>Email me a sign-in link</Button>
          </form>
        )}
      </div>
    </div>
  );
}
