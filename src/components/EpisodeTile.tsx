import { memo } from 'react';
import type { Episode } from '@/api/contracts/domain';
import { Focusable } from '@/navigation/react';
import { Icon } from './Icon';
import { Img } from './Img';
import { ProgressBar, formatRuntime } from './ui';
import styles from './EpisodeTile.module.css';

interface EpisodeTileProps {
  episode: Episode;
  focusId: string;
  onSelect: () => void;
  onFocused?: () => void;
  progress?: number;
  label?: string;
  size?: 'md' | 'lg';
  fallbackImage?: string;
}

/** Large, image-first episode tile: selecting it starts playback immediately. */
export const EpisodeTile = memo(function EpisodeTile({ episode, focusId, onSelect, onFocused, progress, label, size = 'md', fallbackImage }: EpisodeTileProps) {
  return (
    <Focusable
      focusId={focusId}
      onSelect={onSelect}
      onFocused={onFocused}
      className={`${styles.tile} ${styles[size]}`}
      aria-label={`Episode ${episode.episodeNumber}: ${episode.title}${label ? `, ${label}` : ''}`}
      data-testid="episode-tile"
    >
      <div className={styles.frame}>
        <Img src={episode.stillUrl ?? fallbackImage} alt="" width={size === 'lg' ? 720 : 480} fallbackLabel={`Episode ${episode.episodeNumber}`} />
        <div className={styles.scrim} />
        <span className={styles.play}>
          <Icon name="play" size="1.3rem" />
        </span>
        {label ? <span className={styles.label}>{label}</span> : null}
        {progress !== undefined && progress > 0 ? <ProgressBar value={progress} className={styles.progress} /> : null}
      </div>
      <div className={styles.text}>
        <div className={styles.kicker}>
          E{episode.episodeNumber}
          {episode.runtimeMinutes ? ` · ${formatRuntime(episode.runtimeMinutes)}` : ''}
        </div>
        <div className={styles.title}>{episode.title}</div>
        {episode.overview ? <p className={styles.overview}>{episode.overview}</p> : null}
      </div>
    </Focusable>
  );
});
