import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { api, ApiError } from '@/lib/api';
import { Button, Input, Label, Logo } from '@/components/ui';

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
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-sm rounded-xl3 border border-line/70 bg-paper p-7 shadow-soft">
        <div className="flex items-center gap-2"><Logo /><span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cream">Admin</span></div>

        {state === 'verifying' && (
          <div className="mt-8 flex items-center gap-3 text-ink-2">
            <span className="size-5 rounded-full border-2 border-ink border-t-transparent animate-spin" /> Signing you in…
          </div>
        )}

        {state === 'sent' && (
          <div className="mt-8">
            <h1 className="text-2xl">Check your inbox</h1>
            <p className="mt-2 text-ink-3">If <span className="font-medium text-ink">{email}</span> is an admin, a sign-in link is on its way. It works for 15 minutes.</p>
            {devLink && (
              <div className="mt-5 rounded-2xl border border-dashed border-gold bg-gold-soft p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-[#8a5f10]">Local development only</div>
                <p className="mt-1 text-sm text-ink-2">The console mailer is on, so here is the link directly.</p>
                <Button className="mt-3" size="sm" variant="dark" onClick={() => { window.location.href = devLink; }}>Open dev link</Button>
              </div>
            )}
            <button className="mt-6 text-sm font-medium text-ink-3 hover:text-ink" onClick={() => setState('idle')}>Use a different email</button>
          </div>
        )}

        {(state === 'idle' || state === 'sending' || state === 'error') && (
          <form onSubmit={submit} className="mt-8">
            <h1 className="text-2xl">Sign in</h1>
            <p className="mt-2 text-ink-3">We'll email you a one-tap link. No passwords.</p>
            <div className="mt-6">
              <Label htmlFor="email">Admin email</Label>
              <Input id="email" type="email" autoComplete="email" required placeholder="you@thekonnection.org" value={email} onChange={(e) => setEmail(e.target.value)} error={state === 'error' ? error : undefined} />
            </div>
            <Button type="submit" full size="lg" className="mt-5" loading={state === 'sending'}>Email me a sign-in link</Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
