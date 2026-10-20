import { Skeleton } from '@/components/ui';
import styles from './ScreenFallback.module.css';

/** Shown while a lazily loaded route chunk downloads — never a blank screen. */
export function ScreenFallback({ light }: { light?: boolean }) {
  return (
    <div className={`${styles.wrap} ${light ? styles.light : ''}`} aria-busy="true" aria-label="Loading">
      <Skeleton className={styles.hero} />
      <div className={styles.row}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className={styles.card} />
        ))}
      </div>
    </div>
  );
}
