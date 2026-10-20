/**
 * Typed service contracts. The UI depends only on these interfaces.
 * Implementations: `mock/*` (local, no backend), `tmdb/*` + `fixtures/*` (catalog), `remote/*` (REST, see docs/api/openapi.yaml).
 */
import type {
  Audience,
  Channel,
  EpisodeRef,
  Genre,
  MediaRef,
  MediaSummary,
  MediaType,
  MovieDetail,
  Page,
  PlaybackContent,
  PlaybackSession,
  Programme,
  RailQuery,
  SeasonDetail,
  SeriesDetail,
} from './domain';

// ---------------------------------------------------------------------------
// Identity & account
// ---------------------------------------------------------------------------
export interface AuthSession {
  accountId: string;
  accessToken: string;
  expiresAt: string;
  isDemo: boolean;
}

export interface AuthService {
  getSession(): Promise<AuthSession | null>;
  /** Device-code style sign-in suits TV remotes; returns a code the user enters on another device. */
  startDeviceSignIn(): Promise<{ userCode: string; verificationUrl: string; pollIntervalSec: number; deviceCode: string }>;
  pollDeviceSignIn(deviceCode: string): Promise<AuthSession | null>;
  signOut(): Promise<void>;
}

export interface Account {
  id: string;
  email: string;
  displayName: string;
  country: string;
  isDemo: boolean;
}

export interface AccountService {
  getAccount(): Promise<Account>;
}

export interface SubscriptionPack {
  id: string;
  name: string;
  active: boolean;
}

export interface Subscription {
  plan: string;
  packs: SubscriptionPack[];
  renewsOn?: string;
  isDemo: boolean;
}

export interface SubscriptionService {
  getSubscription(): Promise<Subscription>;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export type ProfileKind = 'adult' | 'kids';

export interface Profile {
  id: string;
  name: string;
  avatarId: string;
  kind: ProfileKind;
  createdAt: string;
}

export interface ProfileInput {
  name: string;
  avatarId: string;
  kind: ProfileKind;
}

export interface ProfileService {
  list(): Promise<Profile[]>;
  create(input: ProfileInput): Promise<Profile>;
  update(id: string, input: Partial<ProfileInput>): Promise<Profile>;
  remove(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Catalog, search, recommendations
// ---------------------------------------------------------------------------
export type FeaturedContext = 'home' | 'tv' | 'movies' | 'kids';

export interface CatalogService {
  readonly source: 'tmdb' | 'demo' | 'remote';
  getRail(query: RailQuery): Promise<Page<MediaSummary>>;
  getFeatured(context: FeaturedContext): Promise<MediaSummary[]>;
  getGenres(mediaType: MediaType, audience?: Audience): Promise<Genre[]>;
  getMovie(id: string): Promise<MovieDetail>;
  getSeries(id: string): Promise<SeriesDetail>;
  getSeason(seriesId: string, seasonNumber: number): Promise<SeasonDetail>;
  /** Resolves editorial collection entries (see src/config/originals.ts) into catalog items. */
  resolveCollection(entries: CollectionEntry[]): Promise<MediaSummary[]>;
}

/** An editorial reference to a title. Either a concrete id or a title lookup (resolved through search). */
export type CollectionEntry =
  | { id: string }
  | { lookup: { type: MediaType; title: string; year?: number } };

export interface SearchService {
  search(query: string, options?: { audience?: Audience; page?: number }): Promise<Page<MediaSummary>>;
}

export interface RecommendationService {
  /** Personalised picks seeded from the profile's history and watchlist. */
  forProfile(seeds: { id: string }[], audience: Audience): Promise<MediaSummary[]>;
  similarTo(id: string): Promise<MediaSummary[]>;
}

// ---------------------------------------------------------------------------
// Personal data
// ---------------------------------------------------------------------------
export interface ProgressRecord {
  /** `movie:<id>` or `episode:<seriesId>:<season>:<episode>` */
  key: string;
  media: MediaRef;
  episode?: EpisodeRef;
  /** Next episode, recorded when the player knows it, so Continue Watching can offer "Up next". */
  nextEpisode?: EpisodeRef;
  positionSec: number;
  durationSec: number;
  completed: boolean;
  updatedAt: string;
}

export interface WatchHistoryService {
  list(profileId: string): Promise<ProgressRecord[]>;
  save(profileId: string, record: ProgressRecord): Promise<void>;
  remove(profileId: string, key: string): Promise<void>;
}

export interface WatchlistService {
  list(profileId: string): Promise<MediaRef[]>;
  add(profileId: string, item: MediaRef): Promise<void>;
  remove(profileId: string, id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Live TV & EPG
// ---------------------------------------------------------------------------
export interface LiveTvService {
  getChannels(): Promise<Channel[]>;
}

export interface EpgService {
  /** Programmes overlapping [from, to) for the given channels, keyed by channel id and sorted by start. */
  getSchedule(channelIds: string[], from: Date, to: Date): Promise<Record<string, Programme[]>>;
}

// ---------------------------------------------------------------------------
// Playback & entitlements
// ---------------------------------------------------------------------------
export interface PlaybackService {
  createSession(profileId: string, content: PlaybackContent): Promise<PlaybackSession>;
  heartbeat(sessionId: string, positionSec: number): Promise<void>;
  endSession(sessionId: string): Promise<void>;
}

export interface Entitlement {
  contentId: string;
  entitled: boolean;
  reason?: 'not_subscribed' | 'geo_blocked' | 'parental_lock' | 'concurrency_limit';
  requiredPack?: string;
}

export interface EntitlementService {
  check(profileId: string, content: PlaybackContent): Promise<Entitlement>;
}

// ---------------------------------------------------------------------------
// Parental controls
// ---------------------------------------------------------------------------
export interface ParentalSettings {
  /** Highest certification a Kids profile may see. */
  kidsMaxCertification: 'U' | 'PG';
  /** Require the PIN before playing 18-certified content on adult profiles. */
  pinFor18: boolean;
}

export interface ParentalControlsService {
  /** Production implementations MUST verify server-side; the mock compares against local state. */
  verifyPin(pin: string): Promise<boolean>;
  changePin(currentPin: string, nextPin: string): Promise<boolean>;
  getSettings(): Promise<ParentalSettings>;
  updateSettings(settings: ParentalSettings): Promise<ParentalSettings>;
}

export interface Services {
  mode: 'mock' | 'remote';
  auth: AuthService;
  account: AccountService;
  subscription: SubscriptionService;
  profiles: ProfileService;
  catalog: CatalogService;
  search: SearchService;
  recommendations: RecommendationService;
  history: WatchHistoryService;
  watchlist: WatchlistService;
  live: LiveTvService;
  epg: EpgService;
  playback: PlaybackService;
  entitlements: EntitlementService;
  parental: ParentalControlsService;
}
