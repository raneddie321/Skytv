import { useCallback, type ReactNode } from 'react';
import { FocusSection } from '@/navigation/react';
import type { MediaSummary } from '@/api/contracts/domain';
import { MediaCard, type CardItem } from './MediaCard';
import { preloadImage } from './Img';
import { ErrorState, Skeleton } from './ui';
import styles from './Rail.module.css';

interface RailProps {
  id: string;
  title?: ReactNode;
  action?: ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  empty?: ReactNode;
  skeletonVariant?: 'landscape' | 'poster' | 'large';
  isEmpty?: boolean;
  children?: ReactNode;
  className?: string;
}

/** A titled horizontal row. Owns the focus section and the horizontal scroller. */
export function Rail({ id, title, action, loading, error, onRetry, empty, isEmpty, skeletonVariant = 'landscape', children, className }: RailProps) {
  return (
    <section className={`${styles.rail} ${className ?? ''}`} data-scroll-anchor aria-label={typeof title === 'string' ? title : undefined} data-testid={`rail-${id}`}>
      {title || action ? (
        <div className={styles.header}>
          {title ? <h2 className={styles.title}>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      <FocusSection id={id}>
        {error ? (
          <ErrorState compact onRetry={onRetry} focusId={`${id}-retry`} message="This row couldn’t be loaded." />
        ) : loading ? (
          <div className={`${styles.scroller} no-scrollbar`} aria-busy="true">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className={`${styles.skeleton} ${styles[skeletonVariant]}`} />
            ))}
          </div>
        ) : isEmpty ? (
          <div className={styles.empty}>{empty}</div>
        ) : (
          <div className={`${styles.scroller} no-scrollbar`} data-scroll-x>
            {children}
          </div>
        )}
      </FocusSection>
    </section>
  );
}

interface MediaRailProps extends Omit<RailProps, 'children' | 'isEmpty'> {
  items: MediaSummary[] | CardItem[] | undefined;
  onSelectItem: (item: CardItem) => void;
  variant?: 'landscape' | 'poster' | 'large';
  onNearEnd?: () => void;
  maxItems?: number;
}

export function MediaRail({ id, items, onSelectItem, variant = 'landscape', onNearEnd, maxItems = 40, ...rest }: MediaRailProps) {
  const list = (items ?? []).slice(0, maxItems);
  const onFocusIndex = useCallback(
    (index: number) => {
      for (let i = index + 1; i <= index + 3 && i < list.length; i++) {
        preloadImage(variant === 'poster' ? list[i].posterUrl : list[i].backdropUrl, variant === 'large' ? 640 : 380);
      }
      if (onNearEnd && index >= list.length - 4) onNearEnd();
    },
    [list, onNearEnd, variant],
  );
  return (
    <Rail id={id} {...rest} isEmpty={!rest.loading && !list.length} skeletonVariant={variant}>
      {list.map((item, i) => (
        <MediaCard
          key={item.id}
          item={item}
          variant={variant}
          focusId={`${id}:${item.id}`}
          onSelect={() => onSelectItem(item)}
          onFocused={() => onFocusIndex(i)}
          eager={i < 6}
        />
      ))}
    </Rail>
  );
}
