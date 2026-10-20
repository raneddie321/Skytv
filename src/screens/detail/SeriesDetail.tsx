import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { MediaType, SeriesDetail as Series } from '@/api/contracts/domain';
import { useSeason, useSeries, useSimilar } from '@/api/hooks';
import { CastRow } from '@/components/CastRow';
import { EpisodeTile } from '@/components/EpisodeTile';
import { Img } from '@/components/Img';
import { MediaRail, Rail } from '@/components/Rail';
import { TitleArt } from '@/components/TitleArt';
import { ErrorState, PillButton, SampleNotice, Skeleton } from '@/components/ui';
import { detailPathFor, paths } from '@/app/paths';
import { brand } from '@/config/brand';
import { isOriginal } from '@/config/originals';
import { FocusSection, Focusable, useScreenFocus } from '@/navigation/react';
import { latestForSeries } from '@/state/continueWatching';
import { episodeProgressKey, toMediaRef, useLibrary, useProfileLibrary } from '@/state/library';
import { useActiveProfile } from '@/state/profiles';
import { toast } from '@/state/toasts';
import styles from './Detail.module.css';

export function SeriesDetailView({ id, kids = false }: { id: string; kids?: boolean }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const profile = useActiveProfile()!;
  const library = useProfileLibrary(profile.id);
  const toggleWatchlist = useLibrary((s) => s.toggleWatchlist);
  const series = useSeries(id);
  const similar = useSimilar(id);
  const latest = latestForSeries(library.progress, id);

  // Target episode: resume the latest unfinished one, else the next after a finished one, else S1E1.
  const target = useMemo(() => {
    if (latest?.episode && !latest.completed) return { season: latest.episode.seasonNumber, episode: latest.episode.episodeNumber, label: 'Resume' };
    if (latest?.completed && latest.nextEpisode) return { season: latest.nextEpisode.seasonNumber, episode: latest.nextEpisode.episodeNumber, label: 'Up next' };
    return null;
  }, [latest]);

  const seasons = series.data?.seasons ?? [];
  const firstSeason = seasons[0]?.seasonNumber;
  const seasonParam = Number(params.get('season')) || undefined;
  const selectedSeason =
    seasonParam && seasons.some((s) => s.seasonNumber === seasonParam)
      ? seasonParam
      : target && seasons.some((s) => s.seasonNumber === target.season)
        ? target.season
        : firstSeason;
  const season = useSeason(id, selectedSeason);
  const episodes = season.data?.seasonNumber === selectedSeason ? season.data.episodes : undefined;

  const focusEpisode = target && target.season === selectedSeason ? target.episode : episodes?.[0]?.episodeNumber;
  const screenKey = `series:${id}`;
  useScreenFocus(screenKey, { defaultId: focusEpisode ? `ep:${selectedSeason}:${focusEpisode}` : 'series:list', ready: !!episodes });

  if (series.isError) {
    return (
      <div className={styles.page}>
        <div className={styles.errorPad}>
          <ErrorState title="This title isn’t available" message="It may have been removed, or the catalog is unreachable." onRetry={() => series.refetch()} />
        </div>
      </div>
    );
  }

  const s: Series | undefined = series.data;
  const inList = !!s && library.watchlist.some((w) => w.id === s.id);
  const playEpisode = (seasonNumber: number, episodeNumber: number) =>
    navigate(paths.watch({ kind: 'episode', seriesId: id, seasonNumber, episodeNumber }));
  const meta = s
    ? [s.year, s.genres.slice(0, 2).map((g) => g.name).join(', '), `${s.seasons.length} season${s.seasons.length === 1 ? '' : 's'}`, s.certification, s.rating ? `★ ${s.rating.toFixed(1)}` : null].filter(Boolean)
    : [];

  return (
    <div className={`${styles.page} ${kids ? styles.kids : ''}`} data-testid="series-detail">
      <div className={styles.backdrop}>{s ? <Img src={s.backdropUrl} alt="" width={1600} eager position="70% 30%" /> : null}</div>
      <div className={styles.scrim} />
      <header className={styles.header} data-scroll-anchor="top">
        {!s ? (
          <>
            <Skeleton className={styles.skTitle} />
            <Skeleton className={styles.skLine} />
          </>
        ) : (
          <>
            {isOriginal(s.id) ? (
              <div className={styles.eyebrow}>
                <b>{brand.wordmark}</b> {brand.originalsLabel}
              </div>
            ) : null}
            <h1 className={styles.title}>
              <TitleArt title={s.title} style={s.titleStyle} size="lg" />
            </h1>
            <div className={styles.metaRow}>
              <span className={styles.meta}>{meta.join('  ·  ')}</span>
              <FocusSection id="series-actions">
                <PillButton
                  focusId="series:list"
                  size="sm"
                  icon={inList ? 'check' : 'plus'}
                  label={inList ? 'In My List' : 'My List'}
                  onSelect={() => {
                    const added = toggleWatchlist(profile.id, toMediaRef(s));
                    toast(added ? `Added ${s.title} to My List` : `Removed ${s.title} from My List`, added ? 'bookmark' : 'check');
                  }}
                />
              </FocusSection>
            </div>
            <p className={styles.overview}>{s.overview}</p>
          </>
        )}
      </header>

      <section className={styles.episodesBlock} data-scroll-anchor aria-label="Episodes">
        <FocusSection id="seasons" enterTo="last">
          <div className={`${styles.seasons} no-scrollbar`} data-scroll-x role="tablist" aria-label="Seasons">
            {seasons.map((se) => (
              <Focusable
                key={se.seasonNumber}
                focusId={`season:${se.seasonNumber}`}
                role="tab"
                aria-selected={se.seasonNumber === selectedSeason}
                className={`${styles.season} ${se.seasonNumber === selectedSeason ? styles.seasonActive : ''}`}
                onSelect={() => {
                  const next = new URLSearchParams(params);
                  next.set('season', String(se.seasonNumber));
                  setParams(next, { replace: true });
                }}
                data-testid={`season-${se.seasonNumber}`}
              >
                {se.name.startsWith('Season') ? se.name : `Season ${se.seasonNumber}`}
                <span className={styles.seasonCount}>{se.episodeCount} ep</span>
              </Focusable>
            ))}
          </div>
        </FocusSection>
        <FocusSection id="episodes" enterTo="last">
          {!episodes ? (
            <div className={`${styles.episodes} no-scrollbar`}>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className={styles.skEpisode} />
              ))}
            </div>
          ) : (
            <div className={`${styles.episodes} no-scrollbar`} data-scroll-x data-testid="episode-row">
              {episodes.map((e) => {
                const p = library.progress[episodeProgressKey(id, e.seasonNumber, e.episodeNumber)];
                const isTarget = target && target.season === e.seasonNumber && target.episode === e.episodeNumber;
                return (
                  <EpisodeTile
                    key={e.id}
                    episode={e}
                    focusId={`ep:${e.seasonNumber}:${e.episodeNumber}`}
                    size={kids ? 'lg' : 'md'}
                    label={isTarget ? target.label : !latest && e.episodeNumber === episodes[0].episodeNumber && e.seasonNumber === firstSeason ? 'Start watching' : undefined}
                    progress={p && !p.completed ? p.positionSec / Math.max(1, p.durationSec) : p?.completed ? 1 : undefined}
                    fallbackImage={s?.backdropUrl}
                    onSelect={() => playEpisode(e.seasonNumber, e.episodeNumber)}
                  />
                );
              })}
            </div>
          )}
        </FocusSection>
        {!kids ? <SampleNotice>Playback uses a labelled sample video — catalog data does not include streams.</SampleNotice> : null}
      </section>

      {s?.cast.length ? <CastRow id="series-cast" cast={s.cast} /> : null}
      <MediaRail
        id="series-similar"
        title="More like this"
        items={similar.data}
        loading={similar.isLoading}
        error={similar.isError}
        onRetry={() => similar.refetch()}
        onSelectItem={(item) => navigate(detailPathFor(kids)(item.type as MediaType, item.id))}
      />
      {!s && series.isLoading ? <Rail id="series-loading" loading /> : null}
    </div>
  );
}

export default function SeriesDetail() {
  const { id = '' } = useParams();
  return <SeriesDetailView key={id} id={decodeURIComponent(id)} />;
}
