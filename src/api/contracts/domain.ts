/**
 * Platform-neutral domain model shared by every data source (TMDB, offline fixtures, remote REST API).
 * IDs are namespaced strings so that items from different sources can never collide:
 *   tmdb:movie:550   tmdb:tv:1399   demo:tv:kingsgate   remote:<opaque>
 */
export type MediaType = 'movie' | 'tv';

/** Hint for how a title is typeset over artwork when no logo artwork exists. */
export type TitleStyle = 'sans' | 'condensed' | 'serif' | 'wide';

export interface Genre {
  id: string;
  name: string;
}

export interface MediaSummary {
  id: string;
  type: MediaType;
  title: string;
  overview: string;
  year?: number;
  genres: Genre[];
  /** 0-10 audience score when available. */
  rating?: number;
  /** Age certification (e.g. UK BBFC: U, PG, 12, 15, 18) when known. */
  certification?: string;
  posterUrl?: string;
  backdropUrl?: string;
  titleStyle?: TitleStyle;
  /** Editorial badges supplied by catalog configuration (never inferred from TMDB). */
  badges?: Badge[];
  /** True when the source marks the title as suitable for the Kids experience. */
  kidsSafe?: boolean;
  /** Where the record came from, for diagnostics and attribution. */
  source: 'tmdb' | 'demo' | 'remote';
}

export type Badge = 'original' | 'new' | 'new-episodes' | 'sample';

export interface CastMember {
  id: string;
  name: string;
  character?: string;
  profileUrl?: string;
}

export interface MovieDetail extends MediaSummary {
  type: 'movie';
  runtimeMinutes?: number;
  tagline?: string;
  cast: CastMember[];
  directors: string[];
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  posterUrl?: string;
  year?: number;
}

export interface SeriesDetail extends MediaSummary {
  type: 'tv';
  seasons: SeasonSummary[];
  cast: CastMember[];
  creators: string[];
  status?: string;
  episodeRuntimeMinutes?: number;
}

export interface Episode {
  id: string;
  seriesId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview: string;
  runtimeMinutes?: number;
  stillUrl?: string;
  airDate?: string;
}

export interface SeasonDetail {
  seriesId: string;
  seasonNumber: number;
  name: string;
  overview?: string;
  episodes: Episode[];
}

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
}

export type Audience = 'all' | 'kids';

export type RailKind = 'trending' | 'popular' | 'top_rated' | 'recently_added' | 'genre';

export interface RailQuery {
  kind: RailKind;
  mediaType: MediaType | 'all';
  genreId?: string;
  page?: number;
  audience?: Audience;
}

/** Compact reference stored in watchlists / history (snapshot of what is needed to render a card). */
export interface MediaRef {
  id: string;
  type: MediaType;
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
  year?: number;
  titleStyle?: TitleStyle;
  kidsSafe?: boolean;
}

export interface EpisodeRef {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  stillUrl?: string;
  runtimeMinutes?: number;
}

// ---------------------------------------------------------------------------
// Live TV
// ---------------------------------------------------------------------------
export type ChannelCategory =
  | 'entertainment'
  | 'drama'
  | 'movies'
  | 'sport'
  | 'news'
  | 'documentaries'
  | 'kids'
  | 'music';

export interface Channel {
  id: string;
  number: number;
  name: string;
  category: ChannelCategory;
  logoUrl?: string;
  /** Present only when the account is entitled; resolved through PlaybackService in production. */
  hd?: boolean;
  isDemo: boolean;
}

export interface Programme {
  id: string;
  channelId: string;
  title: string;
  subtitle?: string;
  synopsis: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  imageUrl?: string;
  certification?: string;
  /** Link into the on-demand catalog when the programme is also available on demand. */
  catalogId?: string;
  isLive?: boolean;
  isDemo: boolean;
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------
export type StreamProtocol = 'hls' | 'dash' | 'progressive';

export interface StreamSource {
  url: string;
  protocol: StreamProtocol;
  mimeType: string;
  /** RFC 6381 codec string; used to check Media Source Extensions support before choosing a source. */
  codecs?: string;
  drm?: { system: 'widevine' | 'playready' | 'fairplay'; licenseUrl: string; headers?: Record<string, string> };
}

export interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  url: string;
  kind: 'subtitles' | 'captions';
}

export type PlaybackContent =
  | { kind: 'movie'; id: string }
  | { kind: 'episode'; seriesId: string; seasonNumber: number; episodeNumber: number }
  | { kind: 'channel'; channelId: string };

export interface PlaybackSession {
  sessionId: string;
  content: PlaybackContent;
  sources: StreamSource[];
  subtitles: SubtitleTrack[];
  /** True when the stream is a labelled sample video rather than the selected programme. */
  isSample: boolean;
  isLive: boolean;
  heartbeatIntervalSec: number;
  expiresAt: string;
}
