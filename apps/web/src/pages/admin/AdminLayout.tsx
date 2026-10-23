import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import { Logo, Skeleton } from '@/components/ui';
import { cx } from '@/lib/format';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true, icon: <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z" /> },
  { to: '/admin/families', label: 'Families', icon: <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-2.7 0-6 1.3-6 4v2h12v-2c0-2.7-3.3-4-6-4Zm8 0c-.4 0-.8 0-1.2.1 1.3.9 2.2 2.1 2.2 3.9v2h5v-2c0-2.7-3.3-4-6-4Z" /> },
  { to: '/admin/follow-ups', label: 'Follow-ups', icon: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5h-2v6l5 3 1-1.7-4-2.3V7Z" /> },
  { to: '/admin/assistant', label: 'Assistant', icon: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Zm6 11l.9 2.3 2.3.9-2.3.9L18 20l-.9-2.3-2.3-.9 2.3-.9L18 14Z" /> },
  { to: '/admin/settings', label: 'Settings', icon: <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6c-.6.3-1.2.6-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" /> },
];

const Icon = ({ children }: { children: React.ReactNode }) => <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor" aria-hidden>{children}</svg>;

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
  const strip = r ? `Season ${r.season} · ${r.deadline.daysLeft < 0 ? 'drop-off deadline passed' : r.deadline.daysLeft === 0 ? 'drop-off is today' : `${r.deadline.daysLeft} days to drop-off`}` : null;

  const navLink = (n: (typeof NAV)[number], mobile?: boolean) => (
    <NavLink
      key={n.to} to={n.to} end={n.end}
      className={({ isActive }) => cx(
        'flex items-center transition-colors duration-200',
        mobile ? 'flex-1 flex-col gap-1 py-2 text-[11px] font-medium' : 'gap-3 rounded-2xl px-3.5 py-2.5 text-[15px] font-medium',
        isActive ? (mobile ? 'text-ember' : 'bg-ink text-cream') : (mobile ? 'text-ink-3' : 'text-ink-2 hover:bg-cream-2'),
      )}
    >
      <Icon>{n.icon}</Icon>
      <span>{n.label}</span>
    </NavLink>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line/70 bg-paper/70 p-5 lg:flex">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cream">Admin</span>
        </div>
        <nav className="mt-8 flex flex-col gap-1">{NAV.map((n) => navLink(n))}</nav>
        <div className="mt-auto space-y-3 border-t border-line/70 pt-4">
          <div className="truncate text-sm font-medium text-ink-2" title={me.data.email}>{me.data.email}</div>
          <div className="flex items-center gap-2">
            <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', me.data.store === 'airtable' ? 'bg-pine-soft text-pine' : 'bg-gold-soft text-[#8a5f10]')}>
              <span className="size-1.5 rounded-full bg-current" />{me.data.store === 'airtable' ? 'Airtable' : 'Demo data'}
            </span>
            <button onClick={signOut} className="ml-auto text-sm font-medium text-ink-3 hover:text-ink">Sign out</button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/70 bg-cream/90 px-4 py-3 backdrop-blur pt-safe lg:hidden">
          <div className="flex items-center gap-2"><Logo /><span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cream">Admin</span></div>
          <button onClick={signOut} className="text-sm font-medium text-ink-3">Sign out</button>
        </header>
        {strip && (
          <div className={cx('px-4 py-1.5 text-center text-xs font-medium sm:px-6', r && r.deadline.daysLeft <= 7 ? 'bg-gold-soft text-[#8a5f10]' : 'bg-pine-soft text-pine')}>{strip}</div>
        )}
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 sm:px-6 lg:pb-10">
          <Outlet />
        </div>
        {/* Mobile tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line/70 bg-paper/95 backdrop-blur pb-safe lg:hidden">{NAV.map((n) => navLink(n, true))}</nav>
      </div>
    </div>
  );
}
