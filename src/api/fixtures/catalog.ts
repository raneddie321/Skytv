/**
 * Offline demo catalog built from DEMO_TITLES. Pure TypeScript (no browser APIs) so it can be shared by the
 * frontend (CATALOG_SOURCE=fixtures / TMDB fallback) and by the reference mock REST server.
 */
import type {
  Audience,
  CastMember,
  Episode,
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
import { DEMO_GENRES, DEMO_TITLES, type DemoTitleDef } from './titles';
import { hashString, mulberry32, pick, pickDistinct } from './random';

export const DEMO_ID_PREFIX = 'demo:';
export const STILLS_PER_SERIES = 4;
const PAGE_SIZE = 20;

const ADULT_EPISODE_TITLES = [
  'The Crossing', 'Old Debts', 'Fault Lines', 'Small Hours', 'The Inheritance', 'Burn Notice', 'Safe Harbour',
  'Ghosts', 'The Reckoning', 'Collateral', 'Second Chances', 'Daybreak', 'Blind Spot', 'The Visitor', 'Sanctuary',
  'Echoes', 'Under Pressure', 'Kinship', 'The Offer', 'Point of No Return', 'Wildfire', 'Homecoming', 'The Bargain',
  'Thin Ice', 'Paper Trail', 'Leverage', 'Exposure', 'Last Orders', 'Black Water', 'The Hollow Men', 'Aftershock',
  'Northern Lights', 'Undercover', 'The Long Way Home', 'Endgame', 'Riptide', 'Signals', 'The Witness', 'Smoke',
  'Borrowed Time', 'Crossfire', 'Open Secrets', 'Glass Houses', 'The Quiet Part', 'All In', 'Requiem', 'Fallout',
  'Turning Point', 'The Arrangement', 'Lost and Found', 'Brothers', 'Sisters', 'The Ledger', 'Strangers', 'High Water',
];

const KIDS_EPISODE_TITLES = [
  'The Big Splash', 'Rainbow Day', 'The Lost Teddy', 'Bubble Trouble', 'Picnic Party', 'The Magic Hat', 'Muddy Boots',
  'Birthday Surprise', 'The Kite Contest', 'Snow Day', 'The Treasure Map', 'Super Sandwich', 'Moon Tea', 'Sleepy Sun',
  'The Giant Puddle', 'Dancing Daisies', 'Lights Out', 'Busy Bees', 'The Tidy-Up Song', 'Pancake Pile-Up',
  'A Friend for Fluff', 'The Wobbly Tooth', 'Seaside Day', 'Hide and Seek', 'The Big Race', 'Star Spotting',
  'Fix-It Friday', 'The Noisy Night', 'Sharing Is Caring', 'The Bouncy Castle', 'Rocket Rescue', 'Garden Gnomes',
  'The Snack Mystery', 'Puppet Show', 'Rainy Day Fort', 'The Brave Little Boat', 'Cloud Shapes', 'Mixed-Up Monday',
];

const FIRST_NAMES = [
  'Amara', 'Callum', 'Isla', 'Theo', 'Freya', 'Kofi', 'Niamh', 'Rafael', 'Priya', 'Owen', 'Saoirse', 'Mateo', 'Elin',
  'Jonah', 'Leila', 'Rhys', 'Ines', 'Tobias', 'Yara', 'Declan', 'Maren', 'Idris', 'Clara', 'Felix', 'Anouk', 'Ewan',
];
const LAST_NAMES = [
  'Ashdown', 'Blackwood', 'Carrow', 'Delaney', 'Ellery', 'Fairbairn', 'Garside', 'Holloway', 'Iversen', 'Jardine',
  'Kerrigan', 'Lindqvist', 'Mabry', 'Nakamura', 'Okafor', 'Penhaligon', 'Quill', 'Rowntree', 'Sorensen', 'Thorne',
  'Underhill', 'Vasquez', 'Whitlock', 'Yardley',
];
const CHARACTER_NAMES = [
  'DI Ruth Calder', 'Marcus Vane', 'Dr. Elena Hart', 'Tom Riley', 'Sasha Kerr', 'Captain Hale', 'Jamie Doyle',
  'Agnes Moore', 'Viktor Lenz', 'Nora Quinn', 'Eli Brandt', 'Rosa Castell', 'Father Michael', 'The Commander',
  'Lena Fischer', 'Sam Okoro', 'Harriet Vale', 'Jonah Pike',
];
const KIDS_CHARACTERS = ['Pip', 'Comet', 'Bramble', 'Ziggy', 'Fizz', 'Lulu', 'Finn', 'Shelly', 'Rex', 'Tilly', 'Bolt', 'Poppy'];

export const demoArt = {
  backdrop: (slug: string) => `/demo-art/titles/${slug}/backdrop.webp`,
  poster: (slug: string) => `/demo-art/titles/${slug}/poster.webp`,
  still: (slug: string, n: number) => `/demo-art/titles/${slug}/still-${((n - 1) % STILLS_PER_SERIES) + 1}.webp`,
};

function demoId(def: Pick<DemoTitleDef, 'type' | 'slug'>): string {
  return `${DEMO_ID_PREFIX}${def.type}:${def.slug}`;
}

export function parseDemoId(id: string): { type: MediaType; slug: string } | null {
  const m = /^demo:(movie|tv):(.+)$/.exec(id);
  return m ? { type: m[1] as MediaType, slug: m[2] } : null;
}

function genresOf(def: DemoTitleDef): Genre[] {
  return def.genres.map((g) => ({ id: g, name: DEMO_GENRES[g] ?? g }));
}

function toSummary(def: DemoTitleDef): MediaSummary {
  return {
    id: demoId(def),
    type: def.type,
    title: def.title,
    overview: def.overview,
    year: def.year,
    genres: genresOf(def),
    rating: def.rating,
    certification: def.certification,
    posterUrl: demoArt.poster(def.slug),
    backdropUrl: demoArt.backdrop(def.slug),
    titleStyle: def.titleStyle,
    kidsSafe: !!def.kids,
    badges: def.addedDaysAgo <= 7 ? (def.type === 'tv' ? ['new-episodes'] : ['new']) : undefined,
    source: 'demo',
  };
}

function castFor(def: DemoTitleDef): CastMember[] {
  const rand = mulberry32(hashString(`${def.slug}:cast`));
  const count = def.kids ? 5 : 8;
  const characters = def.kids ? pickDistinct(rand, KIDS_CHARACTERS, count) : pickDistinct(rand, CHARACTER_NAMES, count);
  return characters.map((character, i) => ({
    id: `demo:person:${def.slug}:${i}`,
    name: `${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}`,
    character: def.kids ? `${character} (voice)` : character,
  }));
}

function episodesFor(def: DemoTitleDef, seasonNumber: number): Episode[] {
  const count = def.seasons?.[seasonNumber - 1] ?? 0;
  const rand = mulberry32(hashString(`${def.slug}:s${seasonNumber}`));
  const pool = def.kids ? KIDS_EPISODE_TITLES : ADULT_EPISODE_TITLES;
  const titles =
    seasonNumber === 1 && def.episodeTitles ? [...def.episodeTitles] : pickDistinct(rand, pool, count);
  while (titles.length < count) titles.push(`Episode ${titles.length + 1}`);
  const startYear = def.year - (def.seasons!.length - seasonNumber);
  return titles.slice(0, count).map((title, i) => {
    const runtimeBase = def.episodeRuntime ?? 45;
    const runtime = Math.max(5, Math.round(runtimeBase + (rand() - 0.5) * (def.kids ? 2 : 10)));
    const month = String(1 + ((i * 7) % 12)).padStart(2, '0');
    return {
      id: `${demoId(def)}:s${seasonNumber}e${i + 1}`,
      seriesId: demoId(def),
      seasonNumber,
      episodeNumber: i + 1,
      title,
      overview: episodeOverview(def, title, rand),
      runtimeMinutes: runtime,
      stillUrl: demoArt.still(def.slug, seasonNumber * 3 + i + 1),
      airDate: `${startYear}-${month}-${String(1 + ((i * 5) % 27)).padStart(2, '0')}`,
    };
  });
}

function episodeOverview(def: DemoTitleDef, title: string, rand: () => number): string {
  if (def.kids) {
    const lines = [
      `In "${title}", the friends discover that working together makes everything more fun.`,
      `It's a very special day — and nothing is going quite to plan in "${title}".`,
      `A surprise visitor arrives and everyone helps to make them feel at home.`,
      `There's a puzzle to solve and only teamwork will crack it.`,
    ];
    return pick(rand, lines);
  }
  const lines = [
    'An unexpected arrival forces old allies to choose a side.',
    'A secret from the past resurfaces at the worst possible moment.',
    'Under mounting pressure, a fragile alliance begins to crack.',
    'A dangerous plan is set in motion as the net tightens.',
    'Loyalties are tested when a deal goes badly wrong.',
    'A new lead changes everything — but the price may be too high.',
    'Long-buried tensions finally erupt with devastating consequences.',
    'With time running out, one desperate gamble could save them all.',
  ];
  return pick(rand, lines);
}

function seasonsOf(def: DemoTitleDef) {
  return (def.seasons ?? []).map((episodeCount, i) => ({
    seasonNumber: i + 1,
    name: `Season ${i + 1}`,
    episodeCount,
    year: def.year - ((def.seasons?.length ?? 1) - 1 - i),
  }));
}

function matchesAudience(def: DemoTitleDef, audience: Audience = 'all'): boolean {
  return audience === 'kids' ? !!def.kids : !def.kids;
}

function paginate<T>(items: T[], page = 1): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  return { items: items.slice(start, start + PAGE_SIZE), page, totalPages };
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class FixtureCatalog implements CatalogService, SearchService, RecommendationService {
  readonly source = 'demo' as const;
  private readonly defs: DemoTitleDef[];
  private readonly bySlug: Map<string, DemoTitleDef>;
  /** Simulated latency so loading skeletons are exercised. 0 in tests/server. */
  constructor(private readonly latencyMs = 0, defs: DemoTitleDef[] = DEMO_TITLES) {
    this.defs = defs;
    this.bySlug = new Map(defs.map((d) => [d.slug, d]));
  }

  private async delay<T>(value: T): Promise<T> {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
    return value;
  }

  private find(id: string, type?: MediaType): DemoTitleDef {
    const parsed = parseDemoId(id);
    const def = parsed ? this.bySlug.get(parsed.slug) : undefined;
    if (!def || (type && def.type !== type)) throw new NotFoundError(id);
    return def;
  }

  all(): MediaSummary[] {
    return this.defs.map(toSummary);
  }

  async getRail(query: RailQuery): Promise<Page<MediaSummary>> {
    let defs = this.defs.filter((d) => matchesAudience(d, query.audience));
    if (query.mediaType !== 'all') defs = defs.filter((d) => d.type === query.mediaType);
    switch (query.kind) {
      case 'trending':
        defs = [...defs].sort((a, b) => b.popularity - a.popularity - (a.addedDaysAgo - b.addedDaysAgo) * 0.4);
        break;
      case 'popular':
        defs = [...defs].sort((a, b) => b.popularity - a.popularity);
        break;
      case 'top_rated':
        defs = [...defs].sort((a, b) => b.rating - a.rating);
        break;
      case 'recently_added':
        defs = [...defs].sort((a, b) => a.addedDaysAgo - b.addedDaysAgo);
        break;
      case 'genre':
        defs = defs.filter((d) => !query.genreId || d.genres.includes(query.genreId)).sort((a, b) => b.popularity - a.popularity);
        break;
    }
    return this.delay(paginate(defs.map(toSummary), query.page));
  }

  async getFeatured(context: FeaturedContext): Promise<MediaSummary[]> {
    const slugs: Record<FeaturedContext, string[]> = {
      home: ['kingsgate', 'iron-meridian', 'ember-city', 'the-harbourmaster', 'orbit-nine'],
      tv: ['the-harbourmaster', 'hollow-pines', 'northbound', 'matchday'],
      movies: ['solar-drift', 'ember-city', 'sandglass', 'neon-requiem'],
      kids: ['pip-and-the-puddle-pals', 'captain-comet', 'bubble-bay', 'fizz-and-friends'],
    };
    return this.delay(slugs[context].map((s) => toSummary(this.bySlug.get(s)!)));
  }

  async getGenres(mediaType: MediaType, audience: Audience = 'all'): Promise<Genre[]> {
    const ids = new Set<string>();
    this.defs
      .filter((d) => d.type === mediaType && matchesAudience(d, audience))
      .forEach((d) => d.genres.forEach((g) => ids.add(g)));
    if (audience === 'all') ids.delete('kids');
    return this.delay([...ids].sort().map((id) => ({ id, name: DEMO_GENRES[id] ?? id })));
  }

  async getMovie(id: string): Promise<MovieDetail> {
    const def = this.find(id, 'movie');
    const rand = mulberry32(hashString(`${def.slug}:crew`));
    return this.delay({
      ...toSummary(def),
      type: 'movie',
      runtimeMinutes: def.runtime,
      tagline: def.tagline,
      cast: castFor(def),
      directors: [`${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}`],
    });
  }

  async getSeries(id: string): Promise<SeriesDetail> {
    const def = this.find(id, 'tv');
    const rand = mulberry32(hashString(`${def.slug}:crew`));
    return this.delay({
      ...toSummary(def),
      type: 'tv',
      seasons: seasonsOf(def),
      cast: castFor(def),
      creators: [`${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}`],
      status: def.addedDaysAgo < 30 ? 'Returning Series' : 'Ended',
      episodeRuntimeMinutes: def.episodeRuntime,
    });
  }

  async getSeason(seriesId: string, seasonNumber: number): Promise<SeasonDetail> {
    const def = this.find(seriesId, 'tv');
    if (!def.seasons || seasonNumber < 1 || seasonNumber > def.seasons.length) {
      throw new NotFoundError(`${seriesId} season ${seasonNumber}`);
    }
    return this.delay({
      seriesId,
      seasonNumber,
      name: `Season ${seasonNumber}`,
      episodes: episodesFor(def, seasonNumber),
    });
  }

  async resolveCollection(entries: CollectionEntry[]): Promise<MediaSummary[]> {
    const out: MediaSummary[] = [];
    for (const entry of entries) {
      try {
        if ('id' in entry) {
          out.push(toSummary(this.find(entry.id)));
        } else {
          const hit = this.defs.find(
            (d) => d.type === entry.lookup.type && normalise(d.title) === normalise(entry.lookup.title),
          );
          if (hit) out.push(toSummary(hit));
        }
      } catch {
        // Unknown editorial entries are skipped rather than breaking the whole collection.
      }
    }
    return this.delay(out);
  }

  async search(query: string, options: { audience?: Audience; page?: number } = {}): Promise<Page<MediaSummary>> {
    const q = normalise(query);
    if (!q) return { items: [], page: 1, totalPages: 1 };
    const terms = q.split(' ');
    const scored = this.defs
      .filter((d) => matchesAudience(d, options.audience))
      .map((d) => {
        const title = normalise(d.title);
        const haystack = `${title} ${d.genres.map((g) => normalise(DEMO_GENRES[g] ?? g)).join(' ')}`;
        let score = 0;
        if (title.startsWith(q)) score += 100;
        if (title.split(' ').some((w) => w.startsWith(q))) score += 50;
        if (terms.every((t) => haystack.includes(t))) score += 20;
        if (normalise(d.overview).includes(q)) score += 5;
        return { d, score: score ? score + d.popularity / 100 : 0 };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => toSummary(s.d));
    return this.delay(paginate(scored, options.page));
  }

  async forProfile(seeds: { id: string }[], audience: Audience): Promise<MediaSummary[]> {
    const seedDefs = seeds
      .map((s) => parseDemoId(s.id))
      .map((p) => (p ? this.bySlug.get(p.slug) : undefined))
      .filter((d): d is DemoTitleDef => !!d);
    const seen = new Set(seedDefs.map((d) => d.slug));
    const genreWeights = new Map<string, number>();
    seedDefs.forEach((d, i) => d.genres.forEach((g) => genreWeights.set(g, (genreWeights.get(g) ?? 0) + 1 / (i + 1))));
    const ranked = this.defs
      .filter((d) => matchesAudience(d, audience) && !seen.has(d.slug))
      .map((d) => ({
        d,
        score: d.genres.reduce((acc, g) => acc + (genreWeights.get(g) ?? 0), 0) * 10 + d.rating,
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => toSummary(x.d));
    return this.delay(ranked.slice(0, 16));
  }

  async similarTo(id: string): Promise<MediaSummary[]> {
    const def = this.find(id);
    const ranked = this.defs
      .filter((d) => d.slug !== def.slug && !!d.kids === !!def.kids)
      .map((d) => ({ d, score: d.genres.filter((g) => def.genres.includes(g)).length * 10 + (d.type === def.type ? 3 : 0) + d.rating }))
      .sort((a, b) => b.score - a.score)
      .map((x) => toSummary(x.d));
    return this.delay(ranked.slice(0, 12));
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
  constructor(what: string) {
    super(`Not found: ${what}`);
    this.name = 'NotFoundError';
  }
}
