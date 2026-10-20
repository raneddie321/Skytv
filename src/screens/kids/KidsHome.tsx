import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChannels, useFeatured, useRail } from '@/api/hooks';
import { ChannelLogo } from '@/components/ChannelLogo';
import { Icon } from '@/components/Icon';
import { Img } from '@/components/Img';
import { MediaCard } from '@/components/MediaCard';
import { MediaRail, Rail } from '@/components/Rail';
import { TitleArt } from '@/components/TitleArt';
import { paths } from '@/app/paths';
import { resolvePlayTarget } from '@/app/playback';
import { Focusable, useScreenFocus } from '@/navigation/react';
import { deriveContinueWatching } from '@/state/continueWatching';
import { useProfileLibrary } from '@/state/library';
import { useActiveProfile } from '@/state/profiles';
import { useSettings } from '@/state/settings';
import { kidsAllowed } from './kidsFilter';
import styles from './Kids.module.css';

export default function KidsHome() {
  const navigate = useNavigate();
  const profile = useActiveProfile()!;
  const library = useProfileLibrary(profile.id);
  const max = useSettings((s) => s.parental.kidsMaxCertification);
  const featured = useFeatured('kids');
  const shows = useRail({ kind: 'popular', mediaType: 'tv', audience: 'kids' });
  const movies = useRail({ kind: 'popular', mediaType: 'movie', audience: 'kids' });
  const recent = useRail({ kind: 'recently_added', mediaType: 'all', audience: 'kids' });
  const channels = useChannels();
  const kidsChannels = (channels.data ?? []).filter((c) => c.category === 'kids');
  const cw = useMemo(() => deriveContinueWatching(library.progress).filter((c) => c.media.kidsSafe !== false), [library.progress]);
  const featuredItems = (featured.data ?? []).filter((i) => kidsAllowed(i, max));

  useScreenFocus('kids-home', { defaultId: featuredItems[0] ? `kids-featured:${featuredItems[0].id}` : undefined, ready: !featured.isLoading });
  const open = (item: { type: 'movie' | 'tv'; id: string }) => navigate(paths.kidsDetail(item.type, item.id));

  return (
    <div className={styles.page} data-testid="kids-home">
      <Rail id="kids-featured" loading={featured.isLoading} skeletonVariant="large" className={styles.featuredRail}>
        {featuredItems.map((item, i) => (
          <Focusable
            key={item.id}
            focusId={`kids-featured:${item.id}`}
            className={styles.featured}
            onSelect={() => navigate(paths.watch(resolvePlayTarget(item, library.progress).content))}
            aria-label={`Watch ${item.title}`}
            data-testid="kids-featured"
          >
            <Img src={item.backdropUrl} alt="" width={900} eager={i < 3} />
            <div className={styles.featuredScrim} />
            <div className={styles.featuredTitle}>
              <TitleArt title={item.title} style={item.titleStyle} size="lg" />
            </div>
            <span className={styles.watchNow}>
              <span className={styles.watchIcon}>
                <Icon name="play" size="1.1rem" />
              </span>
              Watch Now
            </span>
          </Focusable>
        ))}
      </Rail>
      {cw.length ? (
        <Rail id="kids-cw" title="Keep watching">
          {cw.map((c) => (
            <MediaCard
              key={c.key}
              focusId={`kids-cw:${c.key}`}
              item={c.media}
              image={c.episode?.stillUrl ?? c.media.backdropUrl}
              progress={c.isUpNext ? undefined : c.progress}
              caption={c.episode ? `Episode ${c.episode.episodeNumber}` : undefined}
              onSelect={() =>
                navigate(
                  paths.watch(
                    c.episode
                      ? { kind: 'episode', seriesId: c.media.id, seasonNumber: c.episode.seasonNumber, episodeNumber: c.episode.episodeNumber }
                      : { kind: 'movie', id: c.media.id },
                  ),
                )
              }
            />
          ))}
        </Rail>
      ) : null}
      {kidsChannels.length ? (
        <Rail id="kids-channels" title="Our channels">
          {kidsChannels.map((c) => (
            <Focusable key={c.id} focusId={`kids-channel:${c.id}`} className={styles.channelTile} onSelect={() => navigate(paths.watch({ kind: 'channel', channelId: c.id }))} aria-label={`Watch ${c.name}`}>
              <span className={styles.channelInner}>
                <ChannelLogo channel={c} size="lg" />
              </span>
            </Focusable>
          ))}
        </Rail>
      ) : null}
      <MediaRail id="kids-shows" title="Popular shows" items={(shows.data?.items ?? []).filter((i) => kidsAllowed(i, max))} loading={shows.isLoading} error={shows.isError} onRetry={() => shows.refetch()} onSelectItem={open} />
      <MediaRail id="kids-movies" title="Movies" items={(movies.data?.items ?? []).filter((i) => kidsAllowed(i, max))} loading={movies.isLoading} error={movies.isError} onRetry={() => movies.refetch()} onSelectItem={open} />
      <MediaRail id="kids-new" title="New for you" items={(recent.data?.items ?? []).filter((i) => kidsAllowed(i, max))} loading={recent.isLoading} error={recent.isError} onRetry={() => recent.refetch()} onSelectItem={open} />
    </div>
  );
}
