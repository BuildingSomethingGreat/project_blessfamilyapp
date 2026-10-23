import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Logo } from '@/components/ui';
import { cx } from '@/lib/format';

const nav = [
  { to: '/families', label: 'Find a family' },
  { to: '/register', label: 'Register my family' },
];

function TabIcon({ name }: { name: 'home' | 'families' | 'register' }) {
  const d = {
    home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z',
    families: 'M4 6h16v12H4zM4 10h16M9 6v12',
    register: 'M12 5v14M5 12h14',
  }[name];
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function PublicLayout() {
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const { pathname } = useLocation();
  const isPortal = pathname.startsWith('/s/');
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-cream/80 backdrop-blur-md pt-safe">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 sm:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('rounded-full px-4 py-2 text-sm font-semibold transition-colors', isActive ? 'bg-ink text-cream' : 'text-ink-2 hover:bg-cream-2')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/families" className="rounded-full bg-ember px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-ember-2 sm:hidden">
            Find a family
          </Link>
        </div>
      </header>

      <div className="flex-1 pb-20 sm:pb-0">
        <Outlet />
      </div>

      <footer className="border-t border-line/60 bg-cream-2/50">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-ink-3">The Konnection · Building Relationships. Connecting Futures.</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">Questions?</p>
            <p className="mt-1 text-ink-3">
              {settings?.contactEmail ? <a className="underline-offset-2 hover:underline" href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a> : '—'}
              {settings?.contactPhone ? <> · {settings.contactPhone}</> : null}
            </p>
            <p className="mt-3 text-ink-3">Drop-off: {settings?.dropoffLocation ?? '—'}{settings?.dropoffHours ? `, ${settings.dropoffHours}` : ''}</p>
          </div>
          <div className="text-sm text-ink-3">
            <p>Families are shown by first names and ages only. Parent names, addresses and phone numbers are never published, and no photos of children appear anywhere on this site.</p>
            <p className="mt-3"><Link to="/admin" className="text-xs text-ink-3/70 hover:text-ink">Admin</Link></p>
          </div>
        </div>
      </footer>

      {!isPortal && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-paper/95 backdrop-blur-md sm:hidden" aria-label="Primary">
          <div className="grid grid-cols-3 pb-safe">
            {([
              { to: '/', label: 'Home', icon: 'home' },
              { to: '/families', label: 'Families', icon: 'families' },
              { to: '/register', label: 'Register', icon: 'register' },
            ] as const).map((t) => (
              <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => cx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors', isActive ? 'text-ember' : 'text-ink-3')}>
                <TabIcon name={t.icon} />
                {t.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
