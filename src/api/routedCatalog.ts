/**
 * Routes catalog calls to TMDB or the offline demo catalog.
 *  - `demo:` ids always go to the offline catalog.
 *  - When TMDB is unreachable (network error, timeout, 5xx, proxy not configured) the offline catalog is used for
 *    the rest of the session and `onFallback` is notified so the UI can show a visible notice.
 */
import type { Audience, Genre, MediaSummary, MediaType, MovieDetail, Page, RailQuery, SeasonDetail, SeriesDetail } from './contracts/domain';
import type { CatalogService, CollectionEntry, FeaturedContext, RecommendationService, SearchService } from './contracts/services';
import { ApiError } from './http';
import type { FixtureCatalog } from './fixtures/catalog';
import type { TmdbCatalog } from './tmdb/catalog';

type Full = CatalogService & SearchService & RecommendationService;

const shouldFallBack = (e: unknown) => e instanceof ApiError && (e.retriable || e.status === 0 || e.status === 401 || e.status >= 500);

export class RoutedCatalog implements Full {
  usingFallback = false;
  constructor(
    private readonly primary: TmdbCatalog,
    private readonly fallback: FixtureCatalog,
    private readonly onFallback: (active: boolean, error?: string) => void,
  ) {}

  get source() {
    return this.usingFallback ? this.fallback.source : this.primary.source;
  }

  /** Re-enables TMDB (e.g. from Settings › Network diagnostics). */
  retryPrimary() {
    this.usingFallback = false;
    this.onFallback(false);
  }

  private async run<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (this.usingFallback) return fallback();
    try {
      return await primary();
    } catch (e) {
      if (!shouldFallBack(e)) throw e;
      this.usingFallback = true;
      this.onFallback(true, (e as Error).message);
      return fallback();
    }
  }

  private byId<T>(id: string, primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    return id.startsWith('demo:') ? fallback() : primary();
  }

  getRail(q: RailQuery): Promise<Page<MediaSummary>> {
    return this.run(() => this.primary.getRail(q), () => this.fallback.getRail(q));
  }
  getFeatured(c: FeaturedContext): Promise<MediaSummary[]> {
    return this.run(() => this.primary.getFeatured(c), () => this.fallback.getFeatured(c));
  }
  getGenres(t: MediaType, a?: Audience): Promise<Genre[]> {
    return this.run(() => this.primary.getGenres(t, a), () => this.fallback.getGenres(t, a));
  }
  getMovie(id: string): Promise<MovieDetail> {
    return this.byId(id, () => this.primary.getMovie(id), () => this.fallback.getMovie(id));
  }
  getSeries(id: string): Promise<SeriesDetail> {
    return this.byId(id, () => this.primary.getSeries(id), () => this.fallback.getSeries(id));
  }
  getSeason(id: string, n: number): Promise<SeasonDetail> {
    return this.byId(id, () => this.primary.getSeason(id, n), () => this.fallback.getSeason(id, n));
  }
  resolveCollection(entries: CollectionEntry[]): Promise<MediaSummary[]> {
    return this.run(() => this.primary.resolveCollection(entries), () => this.fallback.resolveCollection(entries));
  }
  search(q: string, o?: { audience?: Audience; page?: number }): Promise<Page<MediaSummary>> {
    return this.run(() => this.primary.search(q, o), () => this.fallback.search(q, o));
  }
  forProfile(seeds: { id: string }[], a: Audience): Promise<MediaSummary[]> {
    const demoSeeds = seeds.filter((s) => s.id.startsWith('demo:'));
    if (this.usingFallback || (seeds.length && demoSeeds.length === seeds.length)) return this.fallback.forProfile(demoSeeds, a);
    return this.run(() => this.primary.forProfile(seeds, a), () => this.fallback.forProfile(demoSeeds, a));
  }
  similarTo(id: string): Promise<MediaSummary[]> {
    return this.byId(id, () => this.primary.similarTo(id), () => this.fallback.similarTo(id));
  }
}
