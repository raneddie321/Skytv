import { Suspense, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/BrandLogo';
import { Icon, type IconName } from '@/components/Icon';
import { Img } from '@/components/Img';
import { PinDialog } from '@/components/PinPad';
import { paths } from '@/app/paths';
import { avatarUrl } from '@/config/avatars';
import { Clock } from '@/layout/NavBar';
import { ScreenFallback } from '@/layout/ScreenFallback';
import { FocusSection, Focusable, useFocusedId } from '@/navigation/react';
import { useParentalSession } from '@/state/parentalSession';
import { useActiveProfile } from '@/state/profiles';
import styles from './Kids.module.css';

const ITEMS: { id: string; label: string; icon: IconName; path: string }[] = [
  { id: 'home', label: 'Home', icon: 'home', path: paths.kids },
  { id: 'shows', label: 'TV Shows', icon: 'tv', path: paths.kidsShows },
  { id: 'movies', label: 'Movies', icon: 'movies', path: paths.kidsMovies },
  { id: 'search', label: 'Search', icon: 'search', path: paths.kidsSearch },
  { id: 'list', label: 'My List', icon: 'heart', path: paths.kidsList },
];

/** Kids experience shell: bright theme, simplified navigation, PIN-protected exits. */
export default function KidsShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useActiveProfile();
  const unlock = useParentalSession((s) => s.unlock);
  const focusedId = useFocusedId();
  const navFocused = !!focusedId?.startsWith('kidsnav:');
  const [pinFor, setPinFor] = useState<'settings' | null>(null);
  const active = ITEMS.find((i) => (i.path === paths.kids ? location.pathname === paths.kids : location.pathname.startsWith(i.path))) ?? null;

  return (
    <div className={`theme-kids ${styles.shell}`}>
      <header className={styles.bar} data-testid="kids-navbar">
        <BrandLogo kids size="md" />
        <FocusSection id="kidsnav" enterTo="default" defaultId={`kidsnav:${active?.id ?? 'home'}`} returnFocus excludeFromMemory block={['up']}>
          <nav className={styles.nav} aria-label="Kids">
            {ITEMS.map((i) => (
              <Focusable
                key={i.id}
                focusId={`kidsnav:${i.id}`}
                className={`${styles.navItem} ${i === active ? styles.navActive : ''} ${i === active && !navFocused ? styles.navActiveSolid : ''}`}
                aria-current={i === active ? 'page' : undefined}
                onSelect={() => i !== active && navigate(i.path)}
                data-testid={`kidsnav-${i.id}`}
              >
                <Icon name={i.icon} size="1.35rem" />
                <span>{i.label}</span>
              </Focusable>
            ))}
          </nav>
          <div className={styles.right}>
            <Focusable focusId="kidsnav:settings" className={styles.iconBtn} aria-label="Settings (parents)" onSelect={() => setPinFor('settings')}>
              <Icon name="settings" size="1.5rem" />
            </Focusable>
            <Focusable focusId="kidsnav:profile" className={styles.avatar} aria-label="Switch profile (parents)" onSelect={() => navigate(paths.profiles)} data-testid="kids-exit">
              <Img src={avatarUrl(profile?.avatarId ?? 'kids-bloop')} alt="" width={64} eager />
            </Focusable>
            <Clock className={styles.clock} />
          </div>
        </FocusSection>
      </header>
      <main className={styles.main}>
        <Suspense fallback={<ScreenFallback light />}>
          <Outlet />
        </Suspense>
      </main>
      {pinFor ? (
        <PinDialog
          light
          title="Grown-ups only"
          message="Enter the parent PIN to open Settings."
          onClose={() => setPinFor(null)}
          onSuccess={() => {
            unlock();
            setPinFor(null);
            navigate(paths.settings());
          }}
        />
      ) : null}
    </div>
  );
}
