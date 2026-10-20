import { useMemo } from 'react';
import { ChannelLogo } from '@/components/ChannelLogo';
import { Icon } from '@/components/Icon';
import { Img } from '@/components/Img';
import { Badge, ProgressBar, Skeleton, formatTime } from '@/components/ui';
import { FocusSection, Focusable, useFocusedId, useScreenFocus } from '@/navigation/react';
import type { useLiveData } from './useLiveData';
import styles from './LiveTv.module.css';

interface Props {
  data: ReturnType<typeof useLiveData>;
  favourites: Set<string>;
  onWatch: (channelId: string) => void;
  onToggleFavourite: (channelId: string) => void;
}

/** Channel list with a large preview of the focused channel's current programme. */
export function ChannelsView({ data, favourites, onWatch, onToggleFavourite }: Props) {
  const focusedId = useFocusedId();
  const focusedChannel = focusedId?.startsWith('ch:') || focusedId?.startsWith('fav:') ? focusedId.split(':')[1] : null;
  const preview = useMemo(
    () => data.rows.find((r) => r.channel.id === focusedChannel) ?? data.rows[0],
    [data.rows, focusedChannel],
  );
  useScreenFocus('live:channels', { defaultId: data.rows[0] ? `ch:${data.rows[0].channel.id}` : undefined, ready: !data.loading });

  return (
    <div className={styles.channelsLayout}>
      <FocusSection id="live-channels" enterTo="last">
        <div className={styles.channelList} role="list">
          {data.loading
            ? Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className={styles.skRow} />)
            : data.rows.map((r) => (
                <div key={r.channel.id} className={styles.channelRowWrap} data-scroll-anchor role="listitem">
                  <Focusable focusId={`ch:${r.channel.id}`} className={styles.channelRow} onSelect={() => onWatch(r.channel.id)} aria-label={`${r.channel.number} ${r.channel.name}: ${r.now?.title ?? 'No information'}`} data-testid={`channel-${r.channel.number}`}>
                    <span className={styles.channelNumber}>{r.channel.number}</span>
                    <span className={styles.channelLogoCell}>
                      <ChannelLogo channel={r.channel} size="sm" />
                    </span>
                    <span className={styles.channelNow}>
                      <span className={styles.channelProgTitle}>
                        {r.now?.isLive ? <Badge tone="live">Live</Badge> : null} {r.now?.title ?? 'Information unavailable'}
                      </span>
                      <span className={styles.channelTimes}>
                        {r.now ? `${formatTime(r.now.start)} – ${formatTime(r.now.end)}` : ''}
                        {r.next ? `   ·   Next ${formatTime(r.next.start)} ${r.next.title}` : ''}
                      </span>
                      <ProgressBar value={r.progress} className={styles.channelProgress} />
                    </span>
                  </Focusable>
                  <Focusable
                    focusId={`fav:${r.channel.id}`}
                    className={`${styles.favButton} ${favourites.has(r.channel.id) ? styles.favOn : ''}`}
                    aria-label={favourites.has(r.channel.id) ? `Remove ${r.channel.name} from favourites` : `Add ${r.channel.name} to favourites`}
                    aria-pressed={favourites.has(r.channel.id)}
                    onSelect={() => onToggleFavourite(r.channel.id)}
                    data-testid={`fav-${r.channel.number}`}
                  >
                    <Icon name="heart" size="1.3rem" />
                  </Focusable>
                </div>
              ))}
        </div>
      </FocusSection>
      <aside className={styles.preview} aria-live="polite">
        {preview?.now ? (
          <>
            <div className={styles.previewImage}>
              <Img src={preview.now.imageUrl} alt="" width={900} eager />
              <div className={styles.previewScrim} />
              <div className={styles.previewLogo}>
                <ChannelLogo channel={preview.channel} size="md" />
              </div>
              {preview.now.isLive ? (
                <span className={styles.previewLive}>
                  <Badge tone="live">Live</Badge>
                </span>
              ) : null}
            </div>
            <div className={styles.previewMeta}>
              {preview.channel.number} · {formatTime(preview.now.start)} – {formatTime(preview.now.end)}
              {preview.now.certification ? ` · ${preview.now.certification}` : ''}
            </div>
            <h2 className={styles.previewTitle}>{preview.now.title}</h2>
            {preview.now.subtitle ? <div className={styles.previewSub}>{preview.now.subtitle}</div> : null}
            <ProgressBar value={preview.progress} className={styles.previewProgress} live />
            <p className={styles.previewSynopsis}>{preview.now.synopsis}</p>
            {preview.next ? (
              <div className={styles.previewNext}>
                <span>Next</span> {formatTime(preview.next.start)} · {preview.next.title}
              </div>
            ) : null}
            <div className={styles.previewHint}>
              <Icon name="play" size="0.9rem" /> Press OK to watch
            </div>
          </>
        ) : data.loading ? (
          <Skeleton className={styles.previewSkeleton} />
        ) : null}
      </aside>
    </div>
  );
}
