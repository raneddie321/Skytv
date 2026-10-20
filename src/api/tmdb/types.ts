/** Subset of TMDB API v3 response shapes used by the app. */
export interface TmdbPaged<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbListItem {
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  vote_average?: number;
  popularity?: number;
  adult?: boolean;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbCredit {
  id: number;
  name: string;
  character?: string;
  roles?: { character: string }[];
  profile_path?: string | null;
  job?: string;
  order?: number;
}

export interface TmdbMovieDetail extends TmdbListItem {
  genres?: TmdbGenre[];
  runtime?: number | null;
  tagline?: string;
  credits?: { cast: TmdbCredit[]; crew: TmdbCredit[] };
  release_dates?: {
    results: { iso_3166_1: string; release_dates: { certification: string; type: number }[] }[];
  };
}

export interface TmdbSeasonSummary {
  season_number: number;
  name: string;
  episode_count: number;
  poster_path?: string | null;
  air_date?: string | null;
}

export interface TmdbTvDetail extends TmdbListItem {
  genres?: TmdbGenre[];
  seasons?: TmdbSeasonSummary[];
  episode_run_time?: number[];
  status?: string;
  created_by?: { id: number; name: string }[];
  credits?: { cast: TmdbCredit[] };
  aggregate_credits?: { cast: TmdbCredit[] };
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] };
}

export interface TmdbEpisode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview?: string;
  runtime?: number | null;
  still_path?: string | null;
  air_date?: string | null;
}

export interface TmdbSeasonDetail {
  id: number;
  season_number: number;
  name: string;
  overview?: string;
  episodes: TmdbEpisode[];
}
