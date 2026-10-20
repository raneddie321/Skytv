import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/BrandLogo';
import { Icon, type IconName } from '@/components/Icon';
import { Img } from '@/components/Img';
import { Focusable, FocusSection, useFocusedId } from '@/navigation/react';
import { paths } from '@/app/paths';
import { avatarUrl } from '@/config/avatars';
import { useActiveProfile } from '@/state/profiles';
import styles from './NavBar.module.css';

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  path: string;
  match: (pathname: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home', path: paths.home, match: (p) => p === '/' },
  { id: 'live', label: 'Live TV', icon: 'live', path: paths.live, match: (p) => p.startsWith('/live') },
  { id: 'tv', label: 'TV Shows', icon: 'tv', path: paths.tv, match: (p) => p.startsWith('/tv') },
  { id: 'movies', label: 'Movies', icon: 'movies', path: paths.movies, match: (p) => p.startsWith('/movies') },
  { id: 'originals', label: 'Sky Originals', icon: 'originals', path: paths.originals, match: (p) => p.startsWith('/originals') },
  { id: 'apps', label: 'Apps', icon: 'apps', path: paths.apps, match: (p) => p.startsWith('/apps') },
  { id: 'search', label: 'Search', icon: 'search', path: paths.search, match: (p) => p.startsWith('/search') },
];

export function Clock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time className={className} dateTime={now.toISOString()}>
      {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
    </time>
  );
}

export function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useActiveProfile();
  const focusedId = useFocusedId();
  const navFocused = !!focusedId?.startsWith('nav:');
  const active = NAV_ITEMS.find((i) => i.match(location.pathname));
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const hidden = scrolled && !navFocused;

  return (
    <header className={`${styles.bar} ${hidden ? styles.hidden : ''} ${scrolled ? styles.solid : ''}`} data-testid="navbar">
      <div className={styles.logo}>
        <BrandLogo size="md" />
      </div>
      <FocusSection id="nav" enterTo="default" defaultId={`nav:${active?.id ?? 'home'}`} returnFocus block={['up']}>
        <nav className={`${styles.pills} no-scrollbar`} aria-label="Main">
          {NAV_ITEMS.map((item) => {
            const isActive = item === active;
            return (
              <Focusable
                key={item.id}
                focusId={`nav:${item.id}`}
                className={`${styles.pill} ${isActive ? styles.active : ''} ${isActive && !navFocused ? styles.activeSolid : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onSelect={() => {
                  if (!isActive) navigate(item.path);
                }}
                data-testid={`nav-${item.id}`}
              >
                <Icon name={item.icon} size="1.15rem" />
                <span>{item.label}</span>
              </Focusable>
            );
          })}
        </nav>
        <div className={styles.right}>
          <Focusable focusId="nav:watchlist" className={styles.iconButton} aria-label="My List" onSelect={() => navigate(paths.watchlist)}>
            <Icon name="bookmark" size="1.35rem" />
          </Focusable>
          <Focusable focusId="nav:settings" className={styles.iconButton} aria-label="Settings" onSelect={() => navigate(paths.settings())}>
            <Icon name="settings" size="1.35rem" />
          </Focusable>
          <Focusable
            focusId="nav:profile"
            className={styles.avatar}
            aria-label={`Profile: ${profile?.name ?? 'none'}. Switch profile`}
            onSelect={() => navigate(paths.profiles)}
          >
            <Img src={avatarUrl(profile?.avatarId ?? '')} alt="" width={60} eager />
          </Focusable>
          <Clock className={styles.clock} />
        </div>
      </FocusSection>
    </header>
  );
}
