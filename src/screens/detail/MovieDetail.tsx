import { useNavigate, useParams } from 'react-router-dom';
import type { MediaType } from '@/api/contracts/domain';
import { useMovie, useSimilar } from '@/api/hooks';
import { CastRow } from '@/components/CastRow';
import { Img } from '@/components/Img';
import { MediaRail } from '@/components/Rail';
import { TitleArt } from '@/components/TitleArt';
import { ErrorState, PillButton, ProgressBar, SampleNotice, Skeleton, formatRuntime } from '@/components/ui';
import { detailPathFor, paths } from '@/app/paths';
import { minutesLeft, resolvePlayTarget } from '@/app/playback';
import { brand } from '@/config/brand';
import { isOriginal } from '@/config/originals';
import { FocusSection, useScreenFocus } from '@/navigation/react';
import { movieProgressKey, toMediaRef, useLibrary, useProfileLibrary } from '@/state/library';
import { useActiveProfile } from '@/state/profiles';
import { toast } from '@/state/toasts';
import styles from './Detail.module.css';

export function MovieDetailView({ id, kids = false }: { id: string; kids?: boolean }) {
  const navigate = useNavigate();
  const profile = useActiveProfile()!;
  const library = useProfileLibrary(profile.id);
  const toggleWatchlist = useLibrary((s) => s.toggleWatchlist);
  const movie = useMovie(id);
  const similar = useSimilar(id);
  const progress = library.progress[movieProgressKey(id)];
  const target = resolvePlayTarget({ id, type: 'movie' }, library.progress);

  useScreenFocus(`movie:${id}`, { defaultId: 'movie:play', ready: !!movie.data });

  if (movie.isError) {
    return (
      <div className={styles.page}>
        <div className={styles.errorPad}>
          <ErrorState title="This title isn’t available" message="It may have been removed, or the catalog is unreachable." onRetry={() => movie.refetch()} />
        </div>
      </div>
    );
  }
  const m = movie.data;
  const inList = !!m && library.watchlist.some((w) => w.id === m.id);
  const meta = m
    ? [m.year, formatRuntime(m.runtimeMinutes), m.genres.slice(0, 3).map((g) => g.name).join(', '), m.certification, m.rating ? `★ ${m.rating.toFixed(1)}` : null].filter(Boolean)
    : [];

  return (
    <div className={`${styles.page} ${styles.moviePage} ${kids ? styles.kids : ''}`} data-testid="movie-detail">
      <div className={`${styles.backdrop} ${styles.backdropTall}`}>{m ? <Img src={m.backdropUrl} alt="" width={1600} eager position="70% 30%" /> : null}</div>
      <div className={styles.scrim} />
      <header className={`${styles.header} ${styles.movieHeader}`} data-scroll-anchor="top">
        {!m ? (
          <>
            <Skeleton className={styles.skTitle} />
            <Skeleton className={styles.skLine} />
            <Skeleton className={styles.skLine} />
          </>
        ) : (
          <>
            {isOriginal(m.id) ? (
              <div className={styles.eyebrow}>
                <b>{brand.wordmark}</b> {brand.originalsLabel}
              </div>
            ) : null}
            <h1 className={styles.title}>
              <TitleArt title={m.title} style={m.titleStyle} size="lg" />
            </h1>
            <div className={styles.meta}>{meta.join('  ·  ')}</div>
            {m.tagline ? <p className={styles.tagline}>{m.tagline}</p> : null}
            <p className={styles.overview}>{m.overview}</p>
            {progress && !progress.completed && target.resume ? (
              <div className={styles.resumeInfo}>
                <ProgressBar value={progress.positionSec / Math.max(1, progress.durationSec)} className={styles.resumeBar} />
                <span>{minutesLeft(progress.positionSec, progress.durationSec)}</span>
              </div>
            ) : null}
            <FocusSection id="movie-actions">
              <div className={styles.actions}>
                <PillButton focusId="movie:play" variant="primary" icon="play" size="lg" label={target.label} onSelect={() => navigate(paths.watch(target.content))} />
                {target.resume ? (
                  <PillButton focusId="movie:restart" icon="replay10" size="lg" label="Start over" onSelect={() => navigate(paths.watch(target.content, { from: 'start' }))} />
                ) : null}
                <PillButton
                  focusId="movie:list"
                  size="lg"
                  icon={inList ? 'check' : 'plus'}
                  label={inList ? 'In My List' : 'My List'}
                  onSelect={() => {
                    const added = toggleWatchlist(profile.id, toMediaRef(m));
                    toast(added ? `Added ${m.title} to My List` : `Removed ${m.title} from My List`, added ? 'bookmark' : 'check');
                  }}
                />
              </div>
            </FocusSection>
            {m.directors.length ? <p className={styles.credits}>Directed by {m.directors.join(', ')}</p> : null}
            {!kids ? <SampleNotice>Playback uses a labelled sample video — catalog data does not include streams.</SampleNotice> : null}
          </>
        )}
      </header>
      {m?.cast.length ? <CastRow id="movie-cast" cast={m.cast} /> : null}
      <MediaRail
        id="movie-similar"
        title="More like this"
        items={similar.data}
        loading={similar.isLoading}
        error={similar.isError}
        onRetry={() => similar.refetch()}
        onSelectItem={(item) => navigate(detailPathFor(kids)(item.type as MediaType, item.id))}
      />
    </div>
  );
}

export default function MovieDetail() {
  const { id = '' } = useParams();
  return <MovieDetailView key={id} id={decodeURIComponent(id)} />;
}
