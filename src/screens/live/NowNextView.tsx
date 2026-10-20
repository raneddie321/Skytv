import { ChannelLogo } from '@/components/ChannelLogo';
import { Icon } from '@/components/Icon';
import { Img } from '@/components/Img';
import { Badge, ProgressBar, Skeleton, formatTime } from '@/components/ui';
import { FocusSection, Focusable, useScreenFocus } from '@/navigation/react';
import type { useLiveData } from './useLiveData';
import styles from './LiveTv.module.css';

interface Props {
  data: ReturnType<typeof useLiveData>;
  favourites: Set<string>;
  onWatch: (channelId: string) => void;
}

/** Large artwork tiles for what's on now on every channel, with what's next underneath. */
export function NowNextView({ data, favourites, onWatch }: Props) {
  useScreenFocus('live:now-next', { defaultId: data.rows[0] ? `nn:${data.rows[0].channel.id}` : undefined, ready: !data.loading });
  return (
    <FocusSection id="live-nownext">
      <div className={styles.nowNextGrid}>
        {data.loading
          ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className={styles.skTile} />)
          : data.rows.map((r) => (
              <div key={r.channel.id} data-scroll-anchor>
                <Focusable focusId={`nn:${r.channel.id}`} className={styles.nnTile} onSelect={() => onWatch(r.channel.id)} aria-label={`${r.channel.name}: now ${r.now?.title ?? ''}, next ${r.next?.title ?? ''}`} data-testid="now-next-tile">
                  <div className={styles.nnImage}>
                    <Img src={r.now?.imageUrl} alt="" width={460} />
                    <div className={styles.nnScrim} />
                    <div className={styles.nnLogo}>
                      <ChannelLogo channel={r.channel} size="sm" />
                    </div>
                    <span className={styles.nnNumber}>
                      {favourites.has(r.channel.id) ? <Icon name="heart" size="0.9rem" /> : null} {r.channel.number}
                    </span>
                    <div className={styles.nnNow}>
                      <div className={styles.nnLabel}>{r.now?.isLive ? <Badge tone="live">Live</Badge> : 'Now'}</div>
                      <div className={styles.nnTitle}>{r.now?.title ?? 'Information unavailable'}</div>
                      <ProgressBar value={r.progress} live className={styles.nnProgress} />
                    </div>
                  </div>
                  <div className={styles.nnNext}>
                    <span>Next</span>
                    {r.next ? `${formatTime(r.next.start)}  ${r.next.title}` : '—'}
                  </div>
                </Focusable>
              </div>
            ))}
      </div>
    </FocusSection>
  );
}
