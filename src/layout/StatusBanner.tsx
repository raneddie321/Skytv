import { Icon } from '@/components/Icon';
import { useCatalogStatus } from '@/state/catalogStatus';
import styles from './StatusBanner.module.css';

/** Visible notice for offline state and for the TMDB → offline demo catalog fallback. */
export function StatusBanner() {
  const { online, usingFallback } = useCatalogStatus();
  if (online && !usingFallback) return null;
  return (
    <div className={styles.banner} role="status" data-testid="status-banner">
      <Icon name="wifi" size="1.1rem" />
      {!online
        ? 'You’re offline. Showing saved content where available.'
        : 'TMDB is unreachable — showing the offline demo catalog (fictional titles).'}
    </div>
  );
}
