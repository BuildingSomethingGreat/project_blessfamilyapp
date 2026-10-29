import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { Button, Input, Label } from '@/components/ui';
import { shell } from './shared.tsx';

/**
 * "Sponsor log in" for Holiday Konnectors. We email a one-tap link that comes back here with ?token=
 * and lands on their family page. Staff use the privately shared /admin/login instead.
 */
export default function Login() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const nav = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'error'>(token ? 'verifying' : 'idle');
  const [error, setError] = useState('');
  const [devLink, setDevLink] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    api.account.verify(token)
      .then(async () => { await qc.invalidateQueries({ queryKey: ['account'] }); if (alive) nav('/my-family', { replace: true }); })
      .catch((e) => { if (alive) { setError(e instanceof ApiError ? e.message : 'That link is invalid or has expired.'); setState('error'); } });
    return () => { alive = false; };
  }, [token, nav, qc]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending'); setError('');
    try {
      const r = await api.account.login(email);
      setDevLink(r.devLink ?? null);
      setState('sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the link. Try again.');
      setState('error');
    }
  };

  return (
    <div className={`${shell} anim-rise`}>
      <div className="mx-auto my-6 max-w-[460px] rounded-[32px] border border-line bg-white p-[clamp(24px,4vw,40px)] sm:my-12">
        {state === 'verifying' && (
          <div className="flex items-center gap-3 py-6 text-ink-2"><span className="size-5 animate-spin rounded-full border-2 border-ink border-t-transparent" /> Signing you in…</div>
        )}

        {state === 'sent' && (
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[.1em] text-pri">Check your inbox</div>
            <h1 className="mt-1.5 text-[clamp(30px,4vw,38px)] font-extrabold leading-[1.02] tracking-[-.045em]">Your link is on its way.</h1>
            <p className="mt-3 text-[15px] leading-[1.55] text-ink-2">We sent an email to <b className="text-ink">{email}</b>. If you're sponsoring a family, it has your sign-in link. It works for 30 minutes.</p>
            <p className="mt-2 text-[13px] leading-[1.5] text-ink-3">Nothing there? Check spam, or make sure it's the email you used to sponsor your family.</p>
            {devLink && (
              <div className="mt-5 rounded-2xl bg-soft p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-pri-dark">Local development only</div>
                <p className="mt-1 text-[13px] text-ink-2">Email is in console mode, so here is the link.</p>
                <Button className="mt-3" size="sm" variant="dark" onClick={() => { window.location.href = devLink; }}>Open sign-in link</Button>
              </div>
            )}
            <button className="mt-6 text-[13px] font-semibold text-ink-3 hover:text-ink" onClick={() => setState('idle')}>Use a different email</button>
          </div>
        )}

        {(state === 'idle' || state === 'sending' || state === 'error') && (
          <form onSubmit={submit}>
            <div className="text-[12px] font-semibold uppercase tracking-[.1em] text-pri">Sponsor log in</div>
            <h1 className="mt-1.5 text-[clamp(30px,4vw,38px)] font-extrabold leading-[1.02] tracking-[-.045em]">Welcome back.</h1>
            <p className="mt-3 text-[15px] leading-[1.55] text-ink-2">Enter the email you used to choose your family. We'll send a one-tap link. No password needed.</p>
            <div className="mt-6">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={state === 'error' ? error : undefined} />
            </div>
            <Button type="submit" full size="xl" className="mt-5" loading={state === 'sending'}>Email me a link</Button>
            <div className="mt-6 border-t border-line pt-5 text-center text-[13px] text-ink-3">
              Haven't chosen a family yet? <Link to="/families" className="font-semibold text-pri">Find a family</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
