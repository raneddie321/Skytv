import { memo } from 'react';
import type { MediaRef } from '@/api/contracts/domain';
import { isOriginal } from '@/config/originals';
import { brand } from '@/config/brand';
import { Focusable } from '@/navigation/react';
import { Img } from './Img';
import { TitleArt } from './TitleArt';
import { ProgressBar } from './ui';
import styles from './MediaCard.module.css';

export type CardItem = Pick<MediaRef, 'id' | 'type' | 'title' | 'backdropUrl' | 'posterUrl' | 'titleStyle'>;

interface MediaCardProps {
  item: CardItem;
  focusId: string;
  onSelect: () => void;
  onFocused?: () => void;
  progress?: number;
  /** Small caption under the title, e.g. "S2 E4 · 12m left". */
  caption?: string;
  image?: string;
  variant?: 'landscape' | 'poster' | 'large';
  badge?: string;
  eager?: boolean;
}

export const MediaCard = memo(function MediaCard({
  item,
  focusId,
  onSelect,
  onFocused,
  progress,
  caption,
  image,
  variant = 'landscape',
  badge,
  eager,
}: MediaCardProps) {
  const poster = variant === 'poster';
  const src = image ?? (poster ? item.posterUrl ?? item.backdropUrl : item.backdropUrl ?? item.posterUrl);
  const original = isOriginal(item.id);
  return (
    <Focusable
      focusId={focusId}
      onSelect={onSelect}
      onFocused={onFocused}
      className={`${styles.card} ${styles[variant]}`}
      aria-label={`${item.title}${caption ? `, ${caption}` : ''}`}
      data-testid="media-card"
    >
      <div className={styles.frame}>
        <Img src={src} alt="" width={poster ? 200 : variant === 'large' ? 640 : 380} fallbackLabel={item.title} eager={eager} />
        {!poster ? <div className={styles.scrim} /> : null}
        {original && !poster ? (
          <span className={styles.original}>
            <b>{brand.wordmark}</b> {brand.originalsLabel}
          </span>
        ) : null}
        {badge ? <span className={styles.badge}>{badge}</span> : null}
        {!poster ? (
          <div className={styles.meta}>
            <TitleArt title={item.title} style={item.titleStyle} size={variant === 'large' ? 'md' : 'sm'} />
            {caption ? <span className={styles.caption}>{caption}</span> : null}
          </div>
        ) : null}
        {progress !== undefined ? <ProgressBar value={progress} className={styles.progress} /> : null}
      </div>
      {poster ? <span className={styles.posterTitle}>{item.title}</span> : null}
    </Focusable>
  );
});
