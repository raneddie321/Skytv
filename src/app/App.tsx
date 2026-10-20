import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/api/hooks';
import { getServices } from '@/api';
import { startRemoteSync } from '@/api/sync';
import { FocusProvider } from '@/navigation/react';
import { focusManager } from '@/navigation/FocusManager';
import { AppShell } from '@/layout/AppShell';
import { NAV_ITEMS } from '@/layout/NavBar';
import { ScreenFallback } from '@/layout/ScreenFallback';
import { StatusBanner } from '@/layout/StatusBanner';
import { Toasts } from '@/layout/Toasts';
import { useActiveProfile } from '@/state/profiles';
import { prefersReducedMotion, useSettings } from '@/state/settings';
import { useCatalogStatus } from '@/state/catalogStatus';
import { useParentalSession } from '@/state/parentalSession';
import { paths } from './paths';

// Route-level code splitting keeps the initial bundle small for low-powered TV hardware.
const ProfileSelect = lazy(() => import('@/screens/profiles/ProfileSelect'));
const ProfileEdit = lazy(() => import('@/screens/profiles/ProfileEdit'));
const Home = lazy(() => import('@/screens/home/Home'));
const LiveTv = lazy(() => import('@/screens/live/LiveTv'));
const TvShows = lazy(() => import('@/screens/browse/TvShows'));
const Movies = lazy(() => import('@/screens/browse/Movies'));
const SeriesDetail = lazy(() => import('@/screens/detail/SeriesDetail'));
const MovieDetail = lazy(() => import('@/screens/detail/MovieDetail'));
const Originals = lazy(() => import('@/screens/originals/Originals'));
const Apps = lazy(() => import('@/screens/apps/Apps'));
const Search = lazy(() => import('@/screens/search/Search'));
const Watchlist = lazy(() => import('@/screens/watchlist/Watchlist'));
const Settings = lazy(() => import('@/screens/settings/Settings'));
const Player = lazy(() => import('@/screens/player/Player'));
const KidsShell = lazy(() => import('@/screens/kids/KidsShell'));
const KidsHome = lazy(() => import('@/screens/kids/KidsHome'));
const KidsBrowse = lazy(() => import('@/screens/kids/KidsBrowse'));
const KidsDetail = lazy(() => import('@/screens/kids/KidsDetail'));
const KidsSearch = lazy(() => import('@/screens/kids/KidsSearch'));
const KidsList = lazy(() => import('@/screens/kids/KidsList'));
const NotFound = lazy(() => import('@/screens/NotFound'));

const queryClient = createQueryClient();

/** Adult-only routes. Kids profiles are redirected unless a parent unlocked with the PIN (Settings). */
function RequireAdult({ children, allowParent }: { children: ReactNode; allowParent?: boolean }) {
  const profile = useActiveProfile();
  const unlocked = useParentalSession((s) => s.unlocked);
  if (!profile) return <Navigate to={paths.profiles} replace />;
  if (profile.kind === 'kids' && !(allowParent && unlocked)) return <Navigate to={paths.kids} replace />;
  return <>{children}</>;
}

function RequireKids({ children }: { children: ReactNode }) {
  const profile = useActiveProfile();
  if (!profile) return <Navigate to={paths.profiles} replace />;
  if (profile.kind !== 'kids') return <Navigate to={paths.home} replace />;
  return <>{children}</>;
}

function RequireProfile({ children }: { children: ReactNode }) {
  const profile = useActiveProfile();
  if (!profile) return <Navigate to={paths.profiles} replace />;
  return <>{children}</>;
}

const TOP_LEVEL = new Set(NAV_ITEMS.map((i) => i.path).concat([paths.liveGuide, paths.liveNowNext]));
const KIDS_TOP = new Set([paths.kids, paths.kidsShows, paths.kidsMovies, paths.kidsSearch, paths.kidsList]);

/** Application-wide behaviour: Back fallback, settings → document attributes, connectivity, remote sync. */
function GlobalEffects() {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useActiveProfile();
  const accessibility = useSettings((s) => s.accessibility);

  useEffect(() => {
    focusManager.defaultBack = () => {
      const path = location.pathname;
      const focused = focusManager.currentId ?? '';
      if (TOP_LEVEL.has(path)) {
        if (!focused.startsWith('nav:')) {
          window.scrollTo({ top: 0 });
          focusManager.focusSection('nav');
        } else if (path !== paths.home) navigate(paths.home);
        else navigate(paths.profiles);
        return;
      }
      if (KIDS_TOP.has(path)) {
        if (!focused.startsWith('kidsnav:')) focusManager.focusSection('kidsnav');
        else if (path !== paths.kids) navigate(paths.kids);
        return;
      }
      if (path === paths.profiles) {
        if (profile) navigate(profile.kind === 'kids' ? paths.kids : paths.home);
        return;
      }
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0) navigate(-1);
      else navigate(profile?.kind === 'kids' ? paths.kids : paths.home, { replace: true });
    };
  }, [location.pathname, navigate, profile]);

  useEffect(() => {
    const root = document.documentElement;
    const reduce = prefersReducedMotion(accessibility.reduceMotion);
    root.dataset.reduceMotion = String(reduce);
    root.dataset.highContrast = String(accessibility.highContrast);
    root.dataset.largeText = String(accessibility.largeText);
    focusManager.smoothScroll = !reduce;
  }, [accessibility]);

  useEffect(() => {
    const set = () => useCatalogStatus.getState().setOnline(navigator.onLine !== false);
    window.addEventListener('online', set);
    window.addEventListener('offline', set);
    return () => {
      window.removeEventListener('online', set);
      window.removeEventListener('offline', set);
    };
  }, []);

  useEffect(() => startRemoteSync(getServices()), []);

  // Leaving the settings area re-locks parental access for Kids profiles.
  useEffect(() => {
    if (!location.pathname.startsWith('/settings')) useParentalSession.getState().lock();
  }, [location.pathname]);

  return null;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <Routes>
        <Route path={paths.profiles} element={<ProfileSelect />} />
        <Route path={paths.newProfile} element={<ProfileEdit />} />
        <Route path="/profiles/:profileId/edit" element={<ProfileEdit />} />

        <Route
          element={
            <RequireAdult allowParent>
              <AppShell />
            </RequireAdult>
          }
        >
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/:section" element={<Settings />} />
        </Route>

        <Route
          element={
            <RequireAdult>
              <AppShell />
            </RequireAdult>
          }
        >
          <Route index element={<Home />} />
          <Route path="/live" element={<LiveTv />} />
          <Route path="/live/:tab" element={<LiveTv />} />
          <Route path="/tv" element={<TvShows />} />
          <Route path="/tv/:id" element={<SeriesDetail />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/movies/:id" element={<MovieDetail />} />
          <Route path="/originals" element={<Originals />} />
          <Route path="/apps" element={<Apps />} />
          <Route path="/search" element={<Search />} />
          <Route path="/watchlist" element={<Watchlist />} />
        </Route>

        <Route
          path="/kids"
          element={
            <RequireKids>
              <KidsShell />
            </RequireKids>
          }
        >
          <Route index element={<KidsHome />} />
          <Route path="shows" element={<KidsBrowse type="tv" />} />
          <Route path="movies" element={<KidsBrowse type="movie" />} />
          <Route path="search" element={<KidsSearch />} />
          <Route path="list" element={<KidsList />} />
          <Route path="title/:type/:id" element={<KidsDetail />} />
        </Route>

        <Route path="/watch/:kind/*" element={<RequireProfile><Player /></RequireProfile>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FocusProvider>
        <BrowserRouter>
          <GlobalEffects />
          <AppRoutes />
          <StatusBanner />
          <Toasts />
        </BrowserRouter>
      </FocusProvider>
    </QueryClientProvider>
  );
}
