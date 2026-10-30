import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccount } from '@/lib/account';
import { useBoot } from '@/lib/boot';
import { cx } from '@/lib/format';

/** v3 app nav: a floating white pill with the Konnection logo, two links and the purple Log in / account button. */
export function PublicLayout() {
  const { justLoaded } = useBoot();
  const { pathname } = useLocation();
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 5 * 60_000 });
  const onFamilies = pathname.startsWith('/families');
  const { me, signedIn } = useAccount();
  const account = signedIn ? { to: '/my-family', label: me ? `Hi, ${me.sponsor.name.trim().split(/\s+/)[0]}` : 'My family' } : { to: '/login', label: 'Sponsor log in' };
  const onAccount = ['/my-family', '/s/', '/login'].some((p) => pathname.startsWith(p));
  const pill = (active: boolean) => cx('rounded-full px-3.5 py-2 text-[14px] font-medium transition-all duration-200', active ? 'bg-ink text-white' : 'text-ink hover:bg-soft-2');
  return (
    <div className="caps-ui flex min-h-dvh flex-col" style={{ ['--hd' as string]: justLoaded ? '1.75s' : '0s' }}>
      <div className="anim-nav-in sticky top-0 z-40 px-3 pt-3.5 sm:px-8 pt-safe">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 rounded-full border border-line-2 bg-white/82 py-2 pl-4 pr-2 shadow-soft backdrop-blur-[14px]">
          <Link to="/" className="flex items-center gap-2.5 text-ink no-underline">
            <img src="/brand/konnection-logo.png" alt="The Konnection" className="block h-[40px] w-auto" />
            <span className="hidden h-[18px] w-px bg-line sm:block" />
            <span className="hidden text-[14px] font-semibold sm:block">Bless-a-Family</span>
          </Link>
          <nav className="flex items-center gap-0.5">
            <NavLink to="/families" className={cx(pill(onFamilies), 'hidden sm:block')}>Find a Family</NavLink>
            <NavLink to="/register" className={cx(pill(false), 'hidden sm:block')}>Register Family</NavLink>
            <Link to={account.to} className="ml-1 inline-flex h-10 max-w-[180px] items-center gap-2 truncate rounded-full bg-pri px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-pri-dark">
              {signedIn && <span aria-hidden className="grid size-5 flex-none place-items-center rounded-full bg-white/20 text-[11px]">{(me?.sponsor.name.trim()[0] ?? '♥').toUpperCase()}</span>}
              <span className="truncate">{account.label}</span>
            </Link>
          </nav>
        </div>
      </div>
      <div className="flex-1">
        <Outlet />
      </div>
      {pathname !== '/' && (
        <footer className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 px-4 pb-24 pt-10 text-[13px] text-ink-3 sm:px-8 sm:pb-10">
          <div className="flex items-center gap-3"><img src="/brand/konnection-logo.png" alt="" className="h-[30px] w-auto" /><span>© {settings.data?.season ?? new Date().getFullYear()} The Konnection · Detroit, MI</span></div>
          <span>First names and ages only. Parent names, addresses and phone numbers are never published. <Link to="/legal#privacy" className="ml-2 font-semibold text-ink-2 hover:text-ink">Privacy</Link> · <Link to="/legal#terms" className="font-semibold text-ink-2 hover:text-ink">Terms</Link></span>
        </footer>
      )}
      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line-2 bg-white/90 backdrop-blur-[14px] sm:hidden pb-safe" aria-label="Primary">
        <div className="grid grid-cols-4 text-[11px] font-semibold">
          {[['/', 'Home'], ['/families', 'Find a Family'], ['/register', 'Register'], [account.to, signedIn ? 'My family' : 'Log in']].map(([to, label]) => {
            const active = to === '/' ? pathname === '/' : to === account.to ? onAccount : pathname.startsWith(to!);
            return <Link key={label} to={to!} className={cx('flex flex-col items-center gap-1 py-2.5', active ? 'text-pri' : 'text-ink-3')}><span className={cx('block h-1.5 w-5 rounded-full', active ? 'bg-pri' : 'bg-line')} />{label}</Link>;
          })}
        </div>
      </nav>
    </div>
  );
}
