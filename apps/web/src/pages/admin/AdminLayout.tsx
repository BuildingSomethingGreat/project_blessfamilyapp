import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import { KMark, Skeleton } from '@/components/ui';
import { cx } from '@/lib/format';

export function AdminLayout() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const loc = useLocation();
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: api.admin.me, retry: false });
  const report = useQuery({ queryKey: ['admin', 'report'], queryFn: api.admin.report, enabled: me.isSuccess, staleTime: 60_000 });

  useEffect(() => {
    if (me.isError && me.error instanceof ApiError && me.error.status === 401) nav('/admin/login', { replace: true, state: { from: loc.pathname } });
  }, [me.isError, me.error, nav, loc.pathname]);

  if (me.isPending || me.isError) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Skeleton className="h-8 w-40" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      </div>
    );
  }

  const signOut = async () => {
    await api.admin.logout();
    qc.clear();
    nav('/admin/login', { replace: true });
  };
  const r = report.data;
  const NAV = [
    { to: '/admin', label: 'Dashboard', end: true, badge: 0, badgeBg: 'bg-pri' },
    { to: '/admin/review', label: 'Review queue', badge: r?.pipeline.Submitted ?? 0, badgeBg: 'bg-pri' },
    { to: '/admin/families', label: 'Families', badge: 0, badgeBg: 'bg-pri' },
    { to: '/admin/follow-ups', label: 'Dominoes board', badge: r?.followUp.flagged ?? 0, badgeBg: 'bg-bad' },
    { to: '/admin/assistant', label: 'Assistant', badge: 0, badgeBg: 'bg-pri' },
    { to: '/admin/settings', label: 'Settings', badge: 0, badgeBg: 'bg-pri' },
  ];
  const link = (n: (typeof NAV)[number], mobile?: boolean) => (
    <NavLink key={n.to} to={n.to} end={n.end}
      className={({ isActive }) => cx('flex items-center justify-between gap-2 rounded-[14px] px-3 py-[11px] text-[14px] font-semibold transition-all duration-200', mobile && 'flex-none whitespace-nowrap py-2', isActive ? 'bg-ink text-white' : 'text-ink-2 hover:bg-soft-2')}>
      <span>{n.label}</span>
      {n.badge > 0 && <span className={cx('rounded-full px-[7px] py-0.5 text-[11px] font-bold text-white', n.badgeBg)}>{n.badge}</span>}
    </NavLink>
  );
  const storeChip = <span className="inline-flex items-center gap-1.5 rounded-full bg-soft px-[9px] py-[3px] text-[11px] font-semibold text-pri-dark">{me.data.store === 'airtable' ? 'Airtable' : 'Demo data'}</span>;

  return (
    <div className="flex min-h-dvh bg-bg">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[230px] flex-none flex-col gap-1 border-r border-line bg-white px-3.5 py-5 lg:flex">
        <div className="flex items-center gap-2.5 px-2 pb-[18px] pt-1.5">
          <KMark size={32} />
          <div><div className="text-[14px] font-bold leading-[1.1]">Bless-A-Family</div><div className="text-[10px] font-semibold tracking-[.08em] text-ink-3">ADMIN · {r?.season ?? ''}</div></div>
        </div>
        {NAV.map((n) => link(n))}
        <div className="flex-1" />
        <div className="border-t border-line px-2 py-3 text-[12px] text-ink-3">
          <div className="truncate" title={me.data.email}>{me.data.email}</div>
          <div className="mt-1.5 flex items-center justify-between gap-2">{storeChip}<button onClick={signOut} className="font-semibold text-ink-2 hover:text-ink">Sign out</button></div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur pt-safe lg:hidden">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2.5"><KMark size={28} /><div className="text-[13px] font-bold">Bless-A-Family <span className="ml-1 text-[10px] font-semibold tracking-[.08em] text-ink-3">ADMIN</span></div></div>
            <div className="flex items-center gap-3">{storeChip}<button onClick={signOut} className="text-[12px] font-semibold text-ink-2">Sign out</button></div>
          </div>
          <nav className="rail flex gap-1 overflow-x-auto px-3 pb-2.5">{NAV.map((n) => link(n, true))}</nav>
        </header>
        <div className="min-w-0 flex-1 px-4 pb-[60px] pt-[22px] sm:px-[clamp(16px,3vw,36px)] sm:pt-[26px]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
