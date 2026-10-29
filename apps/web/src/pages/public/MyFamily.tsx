import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, getSponsorToken, setSponsorToken, type AccountFamily } from '@/lib/api';
import { useAccount } from '@/lib/account';
import { Skeleton } from '@/components/ui';
import { cx } from '@/lib/format';
import { shell } from './shared.tsx';

/**
 * "My account": where the purple nav button goes once signed in. One family opens straight to its
 * page; several show a short list. Not signed in goes to Log in (or this device's saved family link).
 */
export default function MyFamily() {
  const { me, loading } = useAccount();
  if (loading) return <div className={shell}><div className="mx-auto max-w-[620px]"><Skeleton className="mt-6 h-12 w-2/3" /><Skeleton className="mt-6 h-28" /></div></div>;
  if (!me) {
    const token = getSponsorToken();
    return <Navigate to={token ? `/s/${token}` : '/login'} replace />;
  }
  const active = me.families.filter((f) => f.status !== 'Released');
  if (active.length === 1) return <Navigate to={`/s/${active[0]!.token}`} replace />;
  const first = me.sponsor.name.trim().split(/\s+/)[0] || 'there';

  return (
    <div className={`${shell} anim-rise`}>
      <div className="mx-auto max-w-[620px] py-4">
        <div className="text-[12px] font-semibold uppercase tracking-[.1em] text-pri">Holiday Konnector</div>
        <h1 className="mt-1.5 text-[clamp(32px,5vw,48px)] font-extrabold leading-none tracking-[-.045em]">Hi {first}.</h1>
        {active.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-line bg-white p-7 text-center">
            <h2 className="text-[24px] tracking-[-.035em]">No family yet.</h2>
            <p className="mt-2 text-[15px] text-ink-2">Your family page appears here once you choose one.</p>
            <Link to="/families" className="mt-5 inline-flex h-[50px] items-center rounded-full bg-pri px-6 text-[15px] font-semibold text-white hover:bg-pri-dark">Find a family</Link>
          </div>
        ) : (
          <>
            <p className="mt-2.5 text-[15px] text-ink-2">You're blessing {active.length} families. Thank you.</p>
            <div className="mt-6 grid gap-3">{active.map((f) => <FamilyRow key={f.token} f={f} />)}</div>
          </>
        )}
        <SignedInAs email={me.sponsor.email} className="mt-8" />
      </div>
    </div>
  );
}

function FamilyRow({ f }: { f: AccountFamily }) {
  return (
    <Link to={`/s/${f.token}`} className="group flex items-center gap-4 rounded-[24px] border border-line bg-white p-5 no-underline transition-colors hover:border-pri">
      <div className="flex -space-x-1.5">{(f.colors.length ? f.colors : ['#ede4ff']).slice(0, 3).map((c, i) => <span key={i} className="size-9 rounded-full border-2 border-white" style={{ background: c }} />)}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] font-bold tracking-[-.02em] text-ink">{f.nickname}</div>
        <div className="truncate text-[13px] text-ink-3">{f.kidLine} · {f.sponsorshipId}</div>
      </div>
      <span className={cx('rounded-full px-3 py-1.5 text-[12px] font-semibold', f.status === 'Delivered' || f.status === 'Dropped Off' ? 'bg-ok/10 text-ok' : 'bg-soft text-pri-dark')}>{f.status === 'Dropped Off' ? 'Handed off' : f.status}</span>
      <span aria-hidden className="text-ink-3 transition-transform group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

/** "Signed in as … · Log out", shown on the account and family pages. */
export function SignedInAs({ email, className }: { email: string; className?: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const logout = async () => {
    await api.account.logout().catch(() => {});
    setSponsorToken(null);
    qc.setQueryData(['account'], null);
    nav('/');
  };
  return (
    <div className={cx('text-center text-[13px] text-ink-3', className)}>
      Signed in as <span className="font-semibold text-ink-2">{email}</span> · <button onClick={logout} className="font-semibold text-ink hover:text-pri">Log out</button>
    </div>
  );
}
