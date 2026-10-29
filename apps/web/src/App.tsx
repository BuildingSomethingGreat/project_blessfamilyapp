import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { PublicLayout } from './pages/public/PublicLayout.tsx';
import { AdminLayout } from './pages/admin/AdminLayout.tsx';
import { Loader, shouldShowLoader } from './components/ui/Loader.tsx';
import { BootContext } from './lib/boot.tsx';

const Landing = lazy(() => import('./pages/public/Landing.tsx'));
const Catalog = lazy(() => import('./pages/public/Catalog.tsx'));
const FamilyDetail = lazy(() => import('./pages/public/FamilyDetail.tsx'));
const Claim = lazy(() => import('./pages/public/Claim.tsx'));
const ChipIn = lazy(() => import('./pages/public/ChipIn.tsx'));
const MyFamily = lazy(() => import('./pages/public/MyFamily.tsx'));
const Login = lazy(() => import('./pages/public/Login.tsx'));
const Emails = lazy(() => import('./pages/admin/Emails.tsx'));
const Register = lazy(() => import('./pages/public/Register.tsx'));
const SponsorPortal = lazy(() => import('./pages/public/SponsorPortal.tsx'));
const NotFound = lazy(() => import('./pages/public/NotFound.tsx'));
const Share = lazy(() => import('./pages/public/Share.tsx'));
const Community = lazy(() => import('./pages/admin/Community.tsx'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin.tsx'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard.tsx'));
const Review = lazy(() => import('./pages/admin/Review.tsx'));
const AdminFamilies = lazy(() => import('./pages/admin/Families.tsx'));
const AdminFamily = lazy(() => import('./pages/admin/FamilyDetail.tsx'));
const Sponsors = lazy(() => import('./pages/admin/Sponsors.tsx'));
const Assistant = lazy(() => import('./pages/admin/Assistant.tsx'));
const Settings = lazy(() => import('./pages/admin/Settings.tsx'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const [loading, setLoading] = useState(() => !isAdmin && shouldShowLoader());
  const [justLoaded, setJustLoaded] = useState(loading);
  const done = useCallback(() => { setLoading(false); setTimeout(() => setJustLoaded(false), 4000); }, []);
  return (
    <BootContext.Provider value={{ justLoaded }}>
      {loading && <Loader onDone={done} />}
      <ScrollToTop />
      <Suspense fallback={<div className="p-8 text-center text-ink-3">Loading…</div>}>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname.split('/').slice(0, 2).join('/')}>
            <Route element={<PublicLayout />}>
              <Route index element={<Landing />} />
              <Route path="families" element={<Catalog />} />
              <Route path="families/:slug" element={<FamilyDetail />} />
              <Route path="families/:slug/claim" element={<Claim />} />
              <Route path="families/:slug/chip-in" element={<ChipIn />} />
              <Route path="my-family" element={<MyFamily />} />
              <Route path="login" element={<Login />} />
              <Route path="s/:token" element={<SponsorPortal />} />
              <Route path="share" element={<Share />} />
            </Route>
            <Route path="register" element={<Register />} />
            <Route path="admin/login" element={<AdminLogin />} />
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="review" element={<Review />} />
              <Route path="families" element={<AdminFamilies />} />
              <Route path="families/:id" element={<AdminFamily />} />
              <Route path="sponsors" element={<Sponsors />} />
              <Route path="follow-ups" element={<Navigate to="/admin/sponsors" replace />} />
              <Route path="emails" element={<Emails />} />
              <Route path="assistant" element={<Assistant />} />
              <Route path="community" element={<Community />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </BootContext.Provider>
  );
}
