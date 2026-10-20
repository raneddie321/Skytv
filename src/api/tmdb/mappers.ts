import type {
  CastMember,
  Episode,
  Genre,
  MediaSummary,
  MediaType,
  MovieDetail,
  SeasonDetail,
  SeriesDetail,
} from '../contracts/domain';
import type {
  TmdbCredit,
  TmdbEpisode,
  TmdbListItem,
  TmdbMovieDetail,
  TmdbSeasonDetail,
  TmdbTvDetail,
} from './types';

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
export const CERT_COUNTRY = 'GB';

/** Official TMDB image sizes. */
export type TmdbImageSize = 'w92' | 'w185' | 'w300' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original';

export function tmdbImage(path: string | null | undefined, size: TmdbImageSize): string | undefined {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : undefined;
}

const RESIZE_STEPS: { max: number; size: TmdbImageSize }[] = [
  { max: 92, size: 'w92' },
  { max: 185, size: 'w185' },
  { max: 300, size: 'w300' },
  { max: 342, size: 'w342' },
  { max: 500, size: 'w500' },
  { max: 780, size: 'w780' },
  { max: 1280, size: 'w1280' },
];

/**
 * Picks the smallest official TMDB size that covers the requested pixel width.
 * Non-TMDB URLs (demo art, remote CDN) are returned unchanged.
 */
export function resizeImage(url: string | undefined, pixelWidth: number): string | undefined {
  if (!url || !url.startsWith(TMDB_IMAGE_BASE)) return url;
  const size = RESIZE_STEPS.find((s) => pixelWidth <= s.max)?.size ?? 'original';
  return url.replace(/\/t\/p\/[^/]+\//, `/t/p/${size}/`);
}

export const tmdbId = (type: MediaType, id: number) => `tmdb:${type}:${id}`;

export function parseTmdbId(id: string): { type: MediaType; id: number } | null {
  const m = /^tmdb:(movie|tv):(\d+)$/.exec(id);
  return m ? { type: m[1] as MediaType, id: Number(m[2]) } : null;
}

const yearOf = (date?: string | null) => (date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : undefined);

/** TMDB genre ids treated as kids-appropriate signals (Animation, Family, Kids). Not a safety guarantee. */
export const KIDS_GENRE_IDS = [16, 10751, 10762];
/** Genres excluded from Kids results regardless of other signals. */
export const KIDS_EXCLUDED_GENRE_IDS = [27, 80, 53, 10752, 10768, 9648, 10749, 18, 37, 10763, 10764, 10766, 10767];

export function isKidsCandidate(item: Pick<TmdbListItem, 'genre_ids' | 'adult'>): boolean {
  const ids = item.genre_ids ?? [];
  if (item.adult) return false;
  if (ids.some((g) => KIDS_EXCLUDED_GENRE_IDS.includes(g))) return false;
  return ids.some((g) => KIDS_GENRE_IDS.includes(g));
}

export function mapListItem(
  item: TmdbListItem,
  genreNames: Map<number, string>,
  fallbackType?: MediaType,
): MediaSummary | null {
  const type = (item.media_type === 'movie' || item.media_type === 'tv' ? item.media_type : fallbackType) as MediaType | undefined;
  if (!type || item.media_type === 'person') return null;
  const title = (type === 'movie' ? item.title : item.name) ?? item.title ?? item.name;
  if (!title) return null;
  return {
    id: tmdbId(type, item.id),
    type,
    title,
    overview: item.overview ?? '',
    year: yearOf(type === 'movie' ? item.release_date : item.first_air_date),
    genres: (item.genre_ids ?? []).map((g) => ({ id: String(g), name: genreNames.get(g) ?? '' })).filter((g) => g.name),
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : undefined,
    posterUrl: tmdbImage(item.poster_path, 'w342'),
    backdropUrl: tmdbImage(item.backdrop_path, 'w1280'),
    titleStyle: 'sans',
    kidsSafe: isKidsCandidate(item),
    source: 'tmdb',
  };
}

function mapCast(cast: TmdbCredit[] | undefined): CastMember[] {
  return (cast ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, 16)
    .map((c) => ({
      id: `tmdb:person:${c.id}`,
      name: c.name,
      character: c.character ?? c.roles?.[0]?.character,
      profileUrl: tmdbImage(c.profile_path, 'w185'),
    }));
}

const mapGenres = (genres?: { id: number; name: string }[]): Genre[] =>
  (genres ?? []).map((g) => ({ id: String(g.id), name: g.name }));

export function movieCertification(detail: TmdbMovieDetail, country = CERT_COUNTRY): string | undefined {
  const entry = detail.release_dates?.results.find((r) => r.iso_3166_1 === country);
  return entry?.release_dates.map((d) => d.certification).find((c) => !!c) || undefined;
}

export function tvCertification(detail: TmdbTvDetail, country = CERT_COUNTRY): string | undefined {
  return detail.content_ratings?.results.find((r) => r.iso_3166_1 === country)?.rating || undefined;
}

export function mapMovieDetail(d: TmdbMovieDetail): MovieDetail {
  return {
    id: tmdbId('movie', d.id),
    type: 'movie',
    title: d.title ?? d.original_title ?? 'Untitled',
    overview: d.overview ?? '',
    year: yearOf(d.release_date),
    genres: mapGenres(d.genres),
    rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : undefined,
    certification: movieCertification(d),
    posterUrl: tmdbImage(d.poster_path, 'w500'),
    backdropUrl: tmdbImage(d.backdrop_path, 'w1280'),
    titleStyle: 'sans',
    source: 'tmdb',
    runtimeMinutes: d.runtime ?? undefined,
    tagline: d.tagline || undefined,
    cast: mapCast(d.credits?.cast),
    directors: (d.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name),
    kidsSafe: isKidsCandidate({ genre_ids: d.genres?.map((g) => g.id), adult: d.adult }),
  };
}

export function mapTvDetail(d: TmdbTvDetail): SeriesDetail {
  return {
    id: tmdbId('tv', d.id),
    type: 'tv',
    title: d.name ?? d.original_name ?? 'Untitled',
    overview: d.overview ?? '',
    year: yearOf(d.first_air_date),
    genres: mapGenres(d.genres),
    rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : undefined,
    certification: tvCertification(d),
    posterUrl: tmdbImage(d.poster_path, 'w500'),
    backdropUrl: tmdbImage(d.backdrop_path, 'w1280'),
    titleStyle: 'sans',
    source: 'tmdb',
    // Season 0 ("Specials") is hidden from the main season selector.
    seasons: (d.seasons ?? [])
      .filter((s) => s.season_number > 0 && s.episode_count > 0)
      .map((s) => ({
        seasonNumber: s.season_number,
        name: s.name || `Season ${s.season_number}`,
        episodeCount: s.episode_count,
        posterUrl: tmdbImage(s.poster_path, 'w342'),
        year: yearOf(s.air_date),
      })),
    cast: mapCast(d.aggregate_credits?.cast ?? d.credits?.cast),
    creators: (d.created_by ?? []).map((c) => c.name),
    status: d.status,
    episodeRuntimeMinutes: d.episode_run_time?.[0],
    kidsSafe: isKidsCandidate({ genre_ids: d.genres?.map((g) => g.id), adult: d.adult }),
  };
}

export function mapEpisode(seriesId: string, e: TmdbEpisode, fallbackStill?: string): Episode {
  return {
    id: `${seriesId}:s${e.season_number}e${e.episode_number}`,
    seriesId,
    seasonNumber: e.season_number,
    episodeNumber: e.episode_number,
    title: e.name || `Episode ${e.episode_number}`,
    overview: e.overview ?? '',
    runtimeMinutes: e.runtime ?? undefined,
    stillUrl: tmdbImage(e.still_path, 'w780') ?? fallbackStill,
    airDate: e.air_date ?? undefined,
  };
}

export function mapSeason(seriesId: string, s: TmdbSeasonDetail, fallbackStill?: string): SeasonDetail {
  return {
    seriesId,
    seasonNumber: s.season_number,
    name: s.name || `Season ${s.season_number}`,
    overview: s.overview || undefined,
    episodes: s.episodes.map((e) => mapEpisode(seriesId, e, fallbackStill)),
  };
}

/** Removes duplicate ids (TMDB pagination can repeat items between pages) */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
