/**
 * TMDB-backed catalog, search and recommendations. All requests go through the server-side proxy
 * (server/tmdbProxy.ts), which injects TMDB_API_KEY — the key never reaches the browser bundle.
 */
import type {
  Audience,
  Genre,
  MediaSummary,
  MediaType,
  MovieDetail,
  Page,
  RailQuery,
  SeasonDetail,
  SeriesDetail,
} from '../contracts/domain';
import type { CatalogService, CollectionEntry, FeaturedContext, RecommendationService, SearchService } from '../contracts/services';
import { ApiError, requestJson, withQuery, type FetchLike } from '../http';
import {
  dedupeById,
  isKidsCandidate,
  mapListItem,
  mapMovieDetail,
  mapSeason,
  mapTvDetail,
  parseTmdbId,
} from './mappers';
import type { TmdbGenre, TmdbListItem, TmdbMovieDetail, TmdbPaged, TmdbSeasonDetail, TmdbTvDetail } from './types';

export interface TmdbCatalogOptions {
  proxyBase: string;
  language?: string;
  region?: string;
  fetchImpl?: FetchLike;
}

const normalise = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

export class TmdbCatalog implements CatalogService, SearchService, RecommendationService {
  readonly source = 'tmdb' as const;
  private genreNames: Promise<Map<number, string>> | null = null;
  private readonly seriesBackdrops = new Map<string, string | undefined>();
  private readonly language: string;
  private readonly region: string;

  constructor(private readonly options: TmdbCatalogOptions) {
    this.language = options.language ?? 'en-GB';
    this.region = options.region ?? 'GB';
  }

  private get<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    const url = withQuery(`${this.options.proxyBase}${path}`, { language: this.language, ...params });
    return requestJson<T>(url, { timeoutMs: 8000 }, this.options.fetchImpl ?? ((i, init) => fetch(i, init)));
  }

  private genres(): Promise<Map<number, string>> {
    if (!this.genreNames) {
      this.genreNames = Promise.all([
        this.get<{ genres: TmdbGenre[] }>('/genre/movie/list'),
        this.get<{ genres: TmdbGenre[] }>('/genre/tv/list'),
      ])
        .then(([m, t]) => new Map([...m.genres, ...t.genres].map((g) => [g.id, g.name])))
        .catch((e) => {
          this.genreNames = null;
          throw e;
        });
    }
    return this.genreNames;
  }

  private async mapPage(
    page: TmdbPaged<TmdbListItem>,
    fallbackType?: MediaType,
    audience: Audience = 'all',
  ): Promise<Page<MediaSummary>> {
    const names = await this.genres();
    let raw = page.results.filter((r) => !r.adult);
    if (audience === 'kids') raw = raw.filter(isKidsCandidate);
    const items = dedupeById(
      raw
        .map((r) => mapListItem(r, names, fallbackType))
        .filter((m): m is MediaSummary => !!m && !!(m.backdropUrl || m.posterUrl)),
    );
    return { items, page: page.page, totalPages: Math.min(page.total_pages, 500) };
  }

  private kidsDiscover(type: MediaType, page: number, genreId?: string) {
    if (type === 'movie') {
      return this.get<TmdbPaged<TmdbListItem>>('/discover/movie', {
        with_genres: genreId ? `10751,${genreId}` : '10751',
        certification_country: this.region,
        certification: 'U|PG',
        include_adult: false,
        sort_by: 'popularity.desc',
        page,
      });
    }
    return this.get<TmdbPaged<TmdbListItem>>('/discover/tv', {
      with_genres: genreId ? `10762,${genreId}` : '10762',
      include_adult: false,
      sort_by: 'popularity.desc',
      page,
    });
  }

  async getRail(query: RailQuery): Promise<Page<MediaSummary>> {
    const page = query.page ?? 1;
    const audience = query.audience ?? 'all';
    const types: MediaType[] = query.mediaType === 'all' ? ['tv', 'movie'] : [query.mediaType];

    if (audience === 'kids') {
      const pages = await Promise.all(types.map((t) => this.kidsDiscover(t, page, query.kind === 'genre' ? query.genreId : undefined)));
      const mapped = await Promise.all(pages.map((p, i) => this.mapPage(p, types[i], 'kids')));
      return mergePages(mapped);
    }

    if (query.kind === 'trending') {
      const kind = query.mediaType === 'all' ? 'all' : query.mediaType;
      const res = await this.get<TmdbPaged<TmdbListItem>>(`/trending/${kind}/week`, { page });
      return this.mapPage(res, query.mediaType === 'all' ? undefined : query.mediaType);
    }

    const pathFor = (t: MediaType): [string, Record<string, string | number | boolean>] => {
      switch (query.kind) {
        case 'popular':
          return [`/${t}/popular`, { page, region: this.region }];
        case 'top_rated':
          return [`/${t}/top_rated`, { page, region: this.region }];
        case 'recently_added':
          return [t === 'movie' ? '/movie/now_playing' : '/tv/on_the_air', { page, region: this.region }];
        case 'genre':
        default:
          return [
            `/discover/${t}`,
            { page, with_genres: query.genreId ?? '', sort_by: 'popularity.desc', include_adult: false, 'vote_count.gte': 50 },
          ];
      }
    };
    const pages = await Promise.all(types.map((t) => this.get<TmdbPaged<TmdbListItem>>(...pathFor(t))));
    const mapped = await Promise.all(pages.map((p, i) => this.mapPage(p, types[i])));
    return mergePages(mapped);
  }

  async getFeatured(context: FeaturedContext): Promise<MediaSummary[]> {
    const query: RailQuery =
      context === 'home'
        ? { kind: 'trending', mediaType: 'all' }
        : context === 'kids'
          ? { kind: 'popular', mediaType: 'all', audience: 'kids' }
          : { kind: 'popular', mediaType: context === 'tv' ? 'tv' : 'movie' };
    const page = await this.getRail(query);
    return page.items.filter((i) => i.backdropUrl && i.overview).slice(0, 5);
  }

  async getGenres(mediaType: MediaType, audience: Audience = 'all'): Promise<Genre[]> {
    const res = await this.get<{ genres: TmdbGenre[] }>(`/genre/${mediaType}/list`);
    const excluded = audience === 'kids' ? [27, 80, 53, 10752, 10768, 9648, 10749, 18, 37, 10763, 10764, 10766, 10767, 99] : [];
    return res.genres.filter((g) => !excluded.includes(g.id)).map((g) => ({ id: String(g.id), name: g.name }));
  }

  async getMovie(id: string): Promise<MovieDetail> {
    const parsed = parseTmdbId(id);
    if (!parsed || parsed.type !== 'movie') throw new ApiError(`Unknown movie id ${id}`, 404, 'not_found', false);
    const res = await this.get<TmdbMovieDetail>(`/movie/${parsed.id}`, { append_to_response: 'credits,release_dates' });
    return mapMovieDetail(res);
  }

  async getSeries(id: string): Promise<SeriesDetail> {
    const parsed = parseTmdbId(id);
    if (!parsed || parsed.type !== 'tv') throw new ApiError(`Unknown series id ${id}`, 404, 'not_found', false);
    const res = await this.get<TmdbTvDetail>(`/tv/${parsed.id}`, { append_to_response: 'aggregate_credits,content_ratings' });
    const detail = mapTvDetail(res);
    this.seriesBackdrops.set(id, detail.backdropUrl);
    return detail;
  }

  async getSeason(seriesId: string, seasonNumber: number): Promise<SeasonDetail> {
    const parsed = parseTmdbId(seriesId);
    if (!parsed || parsed.type !== 'tv') throw new ApiError(`Unknown series id ${seriesId}`, 404, 'not_found', false);
    const res = await this.get<TmdbSeasonDetail>(`/tv/${parsed.id}/season/${seasonNumber}`);
    return mapSeason(seriesId, res, this.seriesBackdrops.get(seriesId));
  }

  async resolveCollection(entries: CollectionEntry[]): Promise<MediaSummary[]> {
    const names = await this.genres();
    const resolved = await Promise.all(
      entries.map(async (entry): Promise<MediaSummary | null> => {
        try {
          if ('id' in entry) {
            const parsed = parseTmdbId(entry.id);
            if (!parsed) return null;
            return parsed.type === 'movie' ? await this.getMovie(entry.id) : await this.getSeries(entry.id);
          }
          const { type, title, year } = entry.lookup;
          const res = await this.get<TmdbPaged<TmdbListItem>>(`/search/${type}`, {
            query: title,
            include_adult: false,
            ...(year ? (type === 'movie' ? { year } : { first_air_date_year: year }) : {}),
          });
          // Only accept an exact (normalised) title match — never guess.
          const hit = res.results.find((r) => normalise((type === 'movie' ? r.title : r.name) ?? '') === normalise(title));
          return hit ? mapListItem(hit, names, type) : null;
        } catch {
          return null;
        }
      }),
    );
    return dedupeById(resolved.filter((m): m is MediaSummary => !!m));
  }

  async search(query: string, options: { audience?: Audience; page?: number } = {}): Promise<Page<MediaSummary>> {
    const q = query.trim();
    if (!q) return { items: [], page: 1, totalPages: 1 };
    const res = await this.get<TmdbPaged<TmdbListItem>>('/search/multi', { query: q, include_adult: false, page: options.page ?? 1 });
    return this.mapPage(res, undefined, options.audience);
  }

  async forProfile(seeds: { id: string }[], audience: Audience): Promise<MediaSummary[]> {
    const ids = seeds.map((s) => parseTmdbId(s.id)).filter((p): p is NonNullable<typeof p> => !!p).slice(0, 3);
    const names = await this.genres();
    if (!ids.length) {
      return (await this.getRail({ kind: 'top_rated', mediaType: 'all', audience })).items;
    }
    const lists = await Promise.all(
      ids.map((p) =>
        this.get<TmdbPaged<TmdbListItem>>(`/${p.type}/${p.id}/recommendations`)
          .then((r) => r.results.filter((x) => audience === 'all' || isKidsCandidate(x)).map((x) => mapListItem(x, names, p.type)))
          .catch(() => []),
      ),
    );
    const seedIds = new Set(seeds.map((s) => s.id));
    const interleaved: MediaSummary[] = [];
    for (let i = 0; i < 20; i++) lists.forEach((l) => l[i] && interleaved.push(l[i]!));
    return dedupeById(interleaved.filter((m) => !seedIds.has(m.id) && (m.backdropUrl || m.posterUrl))).slice(0, 20);
  }

  async similarTo(id: string): Promise<MediaSummary[]> {
    const p = parseTmdbId(id);
    if (!p) return [];
    const names = await this.genres();
    const res = await this.get<TmdbPaged<TmdbListItem>>(`/${p.type}/${p.id}/recommendations`);
    let items = res.results;
    if (!items.length) items = (await this.get<TmdbPaged<TmdbListItem>>(`/${p.type}/${p.id}/similar`)).results;
    return dedupeById(
      items.map((x) => mapListItem(x, names, p.type)).filter((m): m is MediaSummary => !!m && !!m.backdropUrl),
    ).slice(0, 16);
  }
}

/** Interleaves several pages (e.g. TV + movies) into one, deduplicated. */
export function mergePages(pages: Page<MediaSummary>[]): Page<MediaSummary> {
  if (pages.length === 1) return pages[0];
  const out: MediaSummary[] = [];
  const max = Math.max(...pages.map((p) => p.items.length));
  for (let i = 0; i < max; i++) pages.forEach((p) => p.items[i] && out.push(p.items[i]));
  return {
    items: dedupeById(out),
    page: pages[0].page,
    totalPages: Math.max(...pages.map((p) => p.totalPages)),
  };
}
