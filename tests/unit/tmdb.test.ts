import { describe, expect, it, vi } from 'vitest';
import { TmdbCatalog, mergePages } from '@/api/tmdb/catalog';
import { dedupeById, isKidsCandidate, mapListItem, mapMovieDetail, mapTvDetail, resizeImage, tmdbImage } from '@/api/tmdb/mappers';

const genres = new Map([
  [18, 'Drama'],
  [80, 'Crime'],
  [16, 'Animation'],
  [10751, 'Family'],
  [10762, 'Kids'],
]);

describe('TMDB mappers', () => {
  it('maps list items with namespaced ids, years and official image URLs', () => {
    const m = mapListItem(
      { id: 1396, media_type: 'tv', name: 'Breaking Point', first_air_date: '2008-01-20', genre_ids: [18, 80], poster_path: '/p.jpg', backdrop_path: '/b.jpg', vote_average: 8.94, overview: 'x' },
      genres,
    );
    expect(m).toMatchObject({ id: 'tmdb:tv:1396', type: 'tv', title: 'Breaking Point', year: 2008, rating: 8.9, source: 'tmdb' });
    expect(m?.genres.map((g) => g.name)).toEqual(['Drama', 'Crime']);
    expect(m?.posterUrl).toBe('https://image.tmdb.org/t/p/w342/p.jpg');
    expect(m?.backdropUrl).toBe('https://image.tmdb.org/t/p/w1280/b.jpg');
  });

  it('drops people from multi-search results and handles missing images', () => {
    expect(mapListItem({ id: 5, media_type: 'person', name: 'Someone' }, genres)).toBeNull();
    const m = mapListItem({ id: 9, media_type: 'movie', title: 'No Art' }, genres);
    expect(m?.posterUrl).toBeUndefined();
    expect(tmdbImage(null, 'w500')).toBeUndefined();
  });

  it('picks the smallest covering TMDB size and leaves other URLs alone', () => {
    expect(resizeImage('https://image.tmdb.org/t/p/w1280/b.jpg', 300)).toBe('https://image.tmdb.org/t/p/w300/b.jpg');
    expect(resizeImage('https://image.tmdb.org/t/p/w342/b.jpg', 3000)).toBe('https://image.tmdb.org/t/p/original/b.jpg');
    expect(resizeImage('/demo-art/titles/x/backdrop.webp', 300)).toBe('/demo-art/titles/x/backdrop.webp');
  });

  it('extracts UK certifications and credits', () => {
    const movie = mapMovieDetail({
      id: 550,
      title: 'Fight Night',
      runtime: 139,
      genres: [{ id: 18, name: 'Drama' }],
      release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'R', type: 3 }] }, { iso_3166_1: 'GB', release_dates: [{ certification: '', type: 1 }, { certification: '18', type: 3 }] }] },
      credits: { cast: [{ id: 2, name: 'B', character: 'Second', order: 1 }, { id: 1, name: 'A', character: 'First', order: 0 }], crew: [{ id: 3, name: 'Director Person', job: 'Director' }] },
    });
    expect(movie.certification).toBe('18');
    expect(movie.cast.map((c) => c.name)).toEqual(['A', 'B']);
    expect(movie.directors).toEqual(['Director Person']);

    const tv = mapTvDetail({
      id: 1,
      name: 'Show',
      seasons: [
        { season_number: 0, name: 'Specials', episode_count: 3 },
        { season_number: 1, name: 'Season 1', episode_count: 8 },
        { season_number: 2, name: 'Season 2', episode_count: 0 },
      ],
      content_ratings: { results: [{ iso_3166_1: 'GB', rating: '15' }] },
      aggregate_credits: { cast: [{ id: 9, name: 'Lead', roles: [{ character: 'Hero' }], order: 0 }] },
    });
    expect(tv.seasons.map((s) => s.seasonNumber)).toEqual([1]);
    expect(tv.certification).toBe('15');
    expect(tv.cast[0]).toMatchObject({ name: 'Lead', character: 'Hero' });
  });

  it('flags kids candidates conservatively', () => {
    expect(isKidsCandidate({ genre_ids: [16, 10751] })).toBe(true);
    expect(isKidsCandidate({ genre_ids: [16, 80] })).toBe(false);
    expect(isKidsCandidate({ genre_ids: [18] })).toBe(false);
    expect(isKidsCandidate({ genre_ids: [10762], adult: true })).toBe(false);
  });

  it('deduplicates and interleaves pages', () => {
    expect(dedupeById([{ id: 'a' }, { id: 'b' }, { id: 'a' }])).toEqual([{ id: 'a' }, { id: 'b' }]);
    const a = { id: 'a' } as never;
    const b = { id: 'b' } as never;
    const merged = mergePages([
      { items: [a, b], page: 1, totalPages: 2 },
      { items: [b], page: 1, totalPages: 5 },
    ]);
    expect(merged.items.map((i) => (i as { id: string }).id)).toEqual(['a', 'b']);
    expect(merged.totalPages).toBe(5);
  });
});

describe('TmdbCatalog (through the proxy)', () => {
  const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

  function fakeFetch(routes: Record<string, unknown>) {
    return vi.fn((url: string) => {
      const path = new URL(url, 'http://x').pathname.replace('/api/tmdb', '');
      if (path === '/genre/movie/list' || path === '/genre/tv/list') return json({ genres: [{ id: 18, name: 'Drama' }, { id: 16, name: 'Animation' }, { id: 10751, name: 'Family' }] });
      if (path in routes) return json(routes[path]);
      return json({ status_message: 'not found' }, 404);
    });
  }

  it('never sends an API key from the browser and filters items without artwork', async () => {
    const fetchImpl = fakeFetch({
      '/trending/all/week': {
        page: 1,
        total_pages: 3,
        total_results: 3,
        results: [
          { id: 1, media_type: 'movie', title: 'With Art', backdrop_path: '/a.jpg', genre_ids: [18] },
          { id: 2, media_type: 'movie', title: 'No Art', genre_ids: [18] },
          { id: 1, media_type: 'movie', title: 'With Art', backdrop_path: '/a.jpg', genre_ids: [18] },
        ],
      },
    });
    const catalog = new TmdbCatalog({ proxyBase: '/api/tmdb', fetchImpl });
    const page = await catalog.getRail({ kind: 'trending', mediaType: 'all' });
    expect(page.items.map((i) => i.title)).toEqual(['With Art']);
    for (const call of fetchImpl.mock.calls) {
      expect(call[0]).not.toContain('api_key');
      expect(call[0]).toContain('language=en-GB');
    }
  });

  it('uses kids discover filters for the Kids audience', async () => {
    const fetchImpl = fakeFetch({
      '/discover/tv': { page: 1, total_pages: 1, total_results: 1, results: [{ id: 7, name: 'Cartoon', poster_path: '/c.jpg', genre_ids: [16, 10751] }] },
    });
    const catalog = new TmdbCatalog({ proxyBase: '/api/tmdb', fetchImpl });
    const page = await catalog.getRail({ kind: 'popular', mediaType: 'tv', audience: 'kids' });
    expect(page.items[0]).toMatchObject({ id: 'tmdb:tv:7', kidsSafe: true });
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes('with_genres=10762'))).toBe(true);
  });

  it('resolves editorial lookups only on exact title matches', async () => {
    const fetchImpl = fakeFetch({
      '/search/tv': { page: 1, total_pages: 1, total_results: 2, results: [{ id: 3, name: 'Gangs of London: The Movie', poster_path: '/x.jpg' }, { id: 4, name: 'Gangs of London', poster_path: '/y.jpg' }] },
    });
    const catalog = new TmdbCatalog({ proxyBase: '/api/tmdb', fetchImpl });
    const items = await catalog.resolveCollection([{ lookup: { type: 'tv', title: 'Gangs of London', year: 2020 } }, { lookup: { type: 'tv', title: 'Unknown Show' } }]);
    expect(items.map((i) => i.id)).toEqual(['tmdb:tv:4']);
  });

  it('surfaces network failures as retriable errors', async () => {
    const catalog = new TmdbCatalog({ proxyBase: '/api/tmdb', fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')) });
    await expect(catalog.getRail({ kind: 'popular', mediaType: 'movie' })).rejects.toMatchObject({ retriable: true, status: 0 });
  });
});
