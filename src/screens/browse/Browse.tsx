import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Genre, MediaSummary, MediaType } from '@/api/contracts/domain';
import { useFeatured, useGenres, useInfiniteRail, useRail } from '@/api/hooks';
import { Grid } from '@/components/Grid';
import { Hero } from '@/components/Hero';
import { MediaCard } from '@/components/MediaCard';
import { MediaRail, Rail } from '@/components/Rail';
import { paths } from '@/app/paths';
import { minutesLeft, resolvePlayTarget } from '@/app/playback';
import { FocusSection, Focusable, useScreenFocus } from '@/navigation/react';
import { deriveContinueWatching } from '@/state/continueWatching';
import { toMediaRef, useLibrary, useProfileLibrary } from '@/state/library';
import { useActiveProfile } from '@/state/profiles';
import { toast } from '@/state/toasts';
import styles from './Browse.module.css';

/** Preferred genre rails per media type (matched by name so it works for TMDB and the demo catalog). */
const RAIL_GENRES: Record<MediaType, string[]> = {
  tv: ['Drama', 'Crime', 'Comedy', 'Sci-Fi & Fantasy', 'Sci-Fi', 'Mystery', 'Documentary'],
  movie: ['Action', 'Thriller', 'Drama', 'Comedy', 'Science Fiction', 'Sci-Fi', 'Adventure', 'Romance'],
};

function GenreRail({ type, genre, onSelect }: { type: MediaType; genre: Genre; onSelect: (i: { type: MediaType; id: string }) => void }) {
  const q = useRail({ kind: 'genre', mediaType: type, genreId: genre.id });
  return (
    <MediaRail
      id={`browse-${type}-genre-${genre.id}`}
      title={genre.name}
      items={q.data?.items}
      loading={q.isLoading}
      error={q.isError}
      onRetry={() => q.refetch()}
      onSelectItem={onSelect}
    />
  );
}

export function Browse({ type }: { type: MediaType }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const genreId = params.get('genre');
  const profile = useActiveProfile()!;
  const library = useProfileLibrary(profile.id);
  const toggleWatchlist = useLibrary((s) => s.toggleWatchlist);
  const label = type === 'tv' ? 'TV Shows' : 'Movies';

  const featured = useFeatured(type === 'tv' ? 'tv' : 'movies');
  const genres = useGenres(type);
  const popular = useRail({ kind: 'popular', mediaType: type });
  const topRated = useRail({ kind: 'top_rated', mediaType: type });
  const recent = useRail({ kind: 'recently_added', mediaType: type });
  const genreGrid = useInfiniteRail({ kind: 'genre', mediaType: type, genreId: genreId ?? undefined }, !!genreId);

  const cw = useMemo(() => deriveContinueWatching(library.progress).filter((c) => c.media.type === type), [library.progress, type]);
  const railGenres = useMemo(() => {
    const all = genres.data ?? [];
    const wanted = RAIL_GENRES[type].map((n) => all.find((g) => g.name === n)).filter((g): g is Genre => !!g);
    return wanted.slice(0, 4);
  }, [genres.data, type]);
  const gridItems = useMemo(() => {
    const seen = new Set<string>();
    return (genreGrid.data?.pages ?? []).flatMap((p) => p.items).filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  }, [genreGrid.data]);

  const screenKey = `${type}-browse:${genreId ?? 'all'}`;
  useScreenFocus(screenKey, { defaultId: genreId ? `genre:${genreId}` : `${type}-hero:play`, ready: !featured.isLoading });

  const openDetails = (item: { type: MediaType; id: string }) => navigate(paths.detail(item.type, item.id));
  const play = (item: MediaSummary) => navigate(paths.watch(resolvePlayTarget(item, library.progress).content));
  const selectGenre = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('genre', id);
    else next.delete('genre');
    setParams(next, { replace: true });
  };

  return (
    <div className={styles.page} data-testid={`browse-${type}`}>
      <Hero
        id={`${type}-hero`}
        items={featured.data}
        loading={featured.isLoading}
        compact
        eyebrow={type === 'tv' ? 'Featured series' : 'Featured film'}
        onPlay={play}
        onDetails={openDetails}
        playLabel={(item) => resolvePlayTarget(item, library.progress).label}
        inList={(id) => library.watchlist.some((w) => w.id === id)}
        onToggleList={(item) => {
          const added = toggleWatchlist(profile.id, toMediaRef(item));
          toast(added ? `Added ${item.title} to My List` : `Removed ${item.title} from My List`);
        }}
      />
      <div className={styles.body}>
        <section data-scroll-anchor className={styles.genreBar} aria-label={`${label} genres`}>
          <FocusSection id={`${type}-genres`} enterTo="last">
            <div className={`${styles.genres} no-scrollbar`} data-scroll-x>
              <Focusable focusId="genre:all" className={`${styles.genre} ${!genreId ? styles.genreActive : ''}`} onSelect={() => selectGenre(null)}>
                All {label}
              </Focusable>
              {(genres.data ?? []).map((g) => (
                <Focusable
                  key={g.id}
                  focusId={`genre:${g.id}`}
                  className={`${styles.genre} ${genreId === g.id ? styles.genreActive : ''}`}
                  onSelect={() => selectGenre(g.id)}
                  data-testid={`genre-${g.name}`}
                >
                  {g.name}
                </Focusable>
              ))}
            </div>
          </FocusSection>
        </section>

        {genreId ? (
          <Grid
            id={`${type}-genre-grid`}
            title={genres.data?.find((g) => g.id === genreId)?.name}
            items={gridItems}
            loading={genreGrid.isLoading}
            loadingMore={genreGrid.isFetchingNextPage}
            error={genreGrid.isError}
            onRetry={() => genreGrid.refetch()}
            onNearEnd={() => {
              if (genreGrid.hasNextPage && !genreGrid.isFetchingNextPage) void genreGrid.fetchNextPage();
            }}
            onSelectItem={openDetails}
            empty="No titles in this genre yet."
          />
        ) : (
          <>
            {cw.length ? (
              <Rail id={`${type}-cw`} title="Continue watching">
                {cw.map((c) => (
                  <MediaCard
                    key={c.key}
                    focusId={`${type}-cw:${c.key}`}
                    item={c.media}
                    image={c.episode?.stillUrl ?? c.media.backdropUrl}
                    progress={c.isUpNext ? undefined : c.progress}
                    badge={c.isUpNext ? 'Up next' : undefined}
                    caption={c.episode ? `S${c.episode.seasonNumber} E${c.episode.episodeNumber} · ${c.episode.title}` : minutesLeft(c.positionSec, c.durationSec)}
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
            <MediaRail id={`${type}-popular`} title={type === 'tv' ? 'Popular series' : 'Popular films'} items={popular.data?.items} loading={popular.isLoading} error={popular.isError} onRetry={() => popular.refetch()} onSelectItem={openDetails} />
            <MediaRail id={`${type}-top`} title="Top rated" items={topRated.data?.items} loading={topRated.isLoading} error={topRated.isError} onRetry={() => topRated.refetch()} onSelectItem={openDetails} variant="poster" />
            <MediaRail id={`${type}-recent`} title={type === 'tv' ? 'New episodes' : 'Recently added'} items={recent.data?.items} loading={recent.isLoading} error={recent.isError} onRetry={() => recent.refetch()} onSelectItem={openDetails} />
            {railGenres.map((g) => (
              <GenreRail key={g.id} type={type} genre={g} onSelect={openDetails} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
