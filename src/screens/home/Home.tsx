import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MediaSummary } from '@/api/contracts/domain';
import { useFeatured, useRail, useRecommendations } from '@/api/hooks';
import { activeOriginalsConfig, useOriginalsCollection } from '@/api/originals';
import { Hero } from '@/components/Hero';
import { MediaCard } from '@/components/MediaCard';
import { MediaRail, Rail } from '@/components/Rail';
import { paths } from '@/app/paths';
import { minutesLeft, resolvePlayTarget } from '@/app/playback';
import { useScreenFocus } from '@/navigation/react';
import { deriveContinueWatching } from '@/state/continueWatching';
import { toMediaRef, useLibrary, useProfileLibrary } from '@/state/library';
import { useActiveProfile } from '@/state/profiles';
import { toast } from '@/state/toasts';
import styles from './Home.module.css';

export default function Home() {
  const navigate = useNavigate();
  const profile = useActiveProfile()!;
  const library = useProfileLibrary(profile.id);
  const toggleWatchlist = useLibrary((s) => s.toggleWatchlist);
  const continueWatching = useMemo(() => deriveContinueWatching(library.progress), [library.progress]);

  const featured = useFeatured('home');
  const trending = useRail({ kind: 'trending', mediaType: 'all' });
  const popularMovies = useRail({ kind: 'popular', mediaType: 'movie' });
  const popularTv = useRail({ kind: 'popular', mediaType: 'tv' });
  const recent = useRail({ kind: 'recently_added', mediaType: 'all' });
  const originalsRow = useOriginalsCollection('home-originals', activeOriginalsConfig().collections.flatMap((c) => c.entries));
  const seeds = useMemo(
    () => [...continueWatching.map((c) => c.media.id), ...library.watchlist.map((w) => w.id)].slice(0, 6),
    [continueWatching, library.watchlist],
  );
  const recommended = useRecommendations(seeds, 'all');

  const heroIds = new Set((featured.data ?? []).map((f) => f.id));
  const trendingItems = (trending.data?.items ?? []).filter((i) => !heroIds.has(i.id));

  useScreenFocus('home', {
    defaultId: continueWatching[0] ? `home-cw:${continueWatching[0].key}` : 'home-hero:play',
    ready: !featured.isLoading,
  });

  const openDetails = (item: { type: 'movie' | 'tv'; id: string }) => navigate(paths.detail(item.type, item.id));
  const play = (item: MediaSummary) => navigate(paths.watch(resolvePlayTarget(item, library.progress).content));
  const inList = (id: string) => library.watchlist.some((w) => w.id === id);

  return (
    <div className={styles.home} data-testid="home">
      <Hero
        id="home-hero"
        items={featured.data}
        loading={featured.isLoading}
        onPlay={play}
        onDetails={openDetails}
        inList={inList}
        playLabel={(item) => resolvePlayTarget(item, library.progress).label}
        onToggleList={(item) => {
          const added = toggleWatchlist(profile.id, toMediaRef(item));
          toast(added ? `Added ${item.title} to My List` : `Removed ${item.title} from My List`, added ? 'bookmark' : 'check');
        }}
      />
      <div className={styles.rows}>
        {continueWatching.length ? (
          <Rail id="home-cw" title="Continue watching">
            {continueWatching.map((c) => (
              <MediaCard
                key={c.key}
                focusId={`home-cw:${c.key}`}
                item={c.media}
                image={c.episode?.stillUrl ?? c.media.backdropUrl}
                progress={c.isUpNext ? undefined : c.progress}
                badge={c.isUpNext ? 'Up next' : undefined}
                caption={
                  c.episode
                    ? `S${c.episode.seasonNumber} E${c.episode.episodeNumber} · ${c.isUpNext ? c.episode.title : minutesLeft(c.positionSec, c.durationSec)}`
                    : minutesLeft(c.positionSec, c.durationSec)
                }
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
        <MediaRail id="home-trending" title="Trending on Sky" items={trendingItems} loading={trending.isLoading} error={trending.isError} onRetry={() => trending.refetch()} onSelectItem={openDetails} />
        <MediaRail id="home-movies" title="Popular movies" items={popularMovies.data?.items} loading={popularMovies.isLoading} error={popularMovies.isError} onRetry={() => popularMovies.refetch()} onSelectItem={openDetails} />
        <MediaRail id="home-tv" title="Popular TV shows" items={popularTv.data?.items} loading={popularTv.isLoading} error={popularTv.isError} onRetry={() => popularTv.refetch()} onSelectItem={openDetails} />
        <MediaRail
          id="home-originals"
          title="Sky Originals"
          items={originalsRow.data}
          loading={originalsRow.isLoading}
          error={originalsRow.isError}
          onRetry={() => originalsRow.refetch()}
          onSelectItem={openDetails}
          variant="large"
          empty="Original titles appear here once the catalog provides them."
        />
        <MediaRail id="home-recommended" title="Recommended for you" items={recommended.data} loading={recommended.isLoading} error={recommended.isError} onRetry={() => recommended.refetch()} onSelectItem={openDetails} />
        <MediaRail id="home-recent" title="Recently added" items={recent.data?.items} loading={recent.isLoading} error={recent.isError} onRetry={() => recent.refetch()} onSelectItem={openDetails} />
        {library.watchlist.length ? (
          <MediaRail id="home-mylist" title="My List" items={library.watchlist} onSelectItem={openDetails} variant="poster" />
        ) : null}
      </div>
    </div>
  );
}
