import type { ReactNode } from 'react';
import { FocusSection } from '@/navigation/react';
import type { CardItem } from './MediaCard';
import { MediaCard } from './MediaCard';
import { ErrorState, Skeleton } from './ui';
import styles from './Grid.module.css';

interface GridProps {
  id: string;
  items: CardItem[];
  onSelectItem: (item: CardItem) => void;
  variant?: 'landscape' | 'poster';
  loading?: boolean;
  loadingMore?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onNearEnd?: () => void;
  empty?: ReactNode;
  title?: ReactNode;
  caption?: (item: CardItem) => string | undefined;
}

/** Wrapping grid of cards with infinite loading when focus approaches the end. */
export function Grid({ id, items, onSelectItem, variant = 'landscape', loading, loadingMore, error, onRetry, onNearEnd, empty, title, caption }: GridProps) {
  return (
    <section className={styles.wrap} data-testid={`grid-${id}`}>
      {title ? <h2 className={styles.title}>{title}</h2> : null}
      <FocusSection id={id}>
        {error && !items.length ? (
          <ErrorState onRetry={onRetry} focusId={`${id}-retry`} />
        ) : loading ? (
          <div className={`${styles.grid} ${styles[variant]}`} aria-busy="true">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className={styles[`sk_${variant}`]} />
            ))}
          </div>
        ) : !items.length ? (
          <div className={styles.empty}>{empty}</div>
        ) : (
          <div className={`${styles.grid} ${styles[variant]}`}>
            {items.map((item, i) => (
              <div key={item.id} data-scroll-anchor className={styles.cell}>
                <MediaCard
                  item={item}
                  variant={variant}
                  focusId={`${id}:${item.id}`}
                  caption={caption?.(item)}
                  onSelect={() => onSelectItem(item)}
                  onFocused={() => {
                    if (onNearEnd && i >= items.length - 8) onNearEnd();
                  }}
                />
              </div>
            ))}
            {loadingMore ? <Skeleton className={styles[`sk_${variant}`]} /> : null}
          </div>
        )}
      </FocusSection>
    </section>
  );
}
