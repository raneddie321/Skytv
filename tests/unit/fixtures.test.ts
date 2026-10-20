import { describe, expect, it } from 'vitest';
import { FixtureCatalog } from '@/api/fixtures/catalog';
import { DEMO_CHANNELS, FixtureLiveTv, generateDay } from '@/api/fixtures/live';
import { DEMO_TITLES } from '@/api/fixtures/titles';

const catalog = new FixtureCatalog(0);

describe('offline demo catalog', () => {
  it('has unique slugs and coherent metadata', () => {
    const slugs = DEMO_TITLES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const t of DEMO_TITLES) {
      if (t.type === 'tv') expect(t.seasons?.length).toBeGreaterThan(0);
      if (t.kids) expect(t.certification).toBe('U');
    }
  });

  it('separates kids and adult audiences', async () => {
    const kids = await catalog.getRail({ kind: 'popular', mediaType: 'all', audience: 'kids' });
    const adults = await catalog.getRail({ kind: 'popular', mediaType: 'all' });
    expect(kids.items.every((i) => i.kidsSafe)).toBe(true);
    expect(adults.items.some((i) => i.kidsSafe)).toBe(false);
  });

  it('builds seasons and episodes deterministically', async () => {
    const series = await catalog.getSeries('demo:tv:kingsgate');
    expect(series.seasons.map((s) => s.episodeCount)).toEqual([8, 8, 6]);
    const s1 = await catalog.getSeason('demo:tv:kingsgate', 1);
    const again = await catalog.getSeason('demo:tv:kingsgate', 1);
    expect(s1.episodes).toHaveLength(8);
    expect(s1.episodes[0].title).toBe('Blood Money');
    expect(again).toEqual(s1);
    await expect(catalog.getSeason('demo:tv:kingsgate', 9)).rejects.toThrow(/Not found/);
  });

  it('searches by title prefix and respects audience', async () => {
    const res = await catalog.search('king');
    expect(res.items[0].title).toBe('Kingsgate');
    const kids = await catalog.search('pip', { audience: 'kids' });
    expect(kids.items[0].title).toBe('Pip & the Puddle Pals');
    expect((await catalog.search('pip')).items.find((i) => i.title.startsWith('Pip'))).toBeUndefined();
  });

  it('recommends unseen titles from similar genres', async () => {
    const recs = await catalog.forProfile([{ id: 'demo:tv:kingsgate' }], 'all');
    expect(recs.find((r) => r.id === 'demo:tv:kingsgate')).toBeUndefined();
    expect(recs[0].genres.some((g) => ['crime', 'thriller', 'drama'].includes(g.id))).toBe(true);
  });

  it('deduplicates editorial collections', async () => {
    const items = await catalog.resolveCollection([{ id: 'demo:tv:saltmarsh' }, { id: 'demo:tv:saltmarsh' }, { id: 'demo:tv:missing' }]);
    expect(items.map((i) => i.id)).toEqual(['demo:tv:saltmarsh']);
  });
});

describe('demo live TV', () => {
  it('generates a gap-free 24h schedule for each channel', () => {
    const day = Date.UTC(2026, 9, 20);
    for (const ch of DEMO_CHANNELS) {
      const progs = generateDay(ch, day);
      expect(Date.parse(progs[0].start)).toBe(day);
      expect(Date.parse(progs[progs.length - 1].end)).toBe(day + 86_400_000);
      for (let i = 1; i < progs.length; i++) expect(progs[i].start).toBe(progs[i - 1].end);
      expect(progs.every((p) => p.isDemo)).toBe(true);
    }
  });

  it('returns now/next for any time window, including across midnight', async () => {
    const live = new FixtureLiveTv(0);
    const channels = await live.getChannels();
    expect(channels.map((c) => c.number)).toEqual([...channels.map((c) => c.number)].sort((a, b) => a - b));
    const from = new Date(Date.UTC(2026, 9, 20, 22, 0));
    const to = new Date(Date.UTC(2026, 9, 21, 3, 0));
    const schedule = await live.getSchedule([channels[0].id], from, to);
    const list = schedule[channels[0].id];
    expect(Date.parse(list[0].start)).toBeLessThanOrEqual(from.getTime());
    expect(Date.parse(list[list.length - 1].end)).toBeGreaterThanOrEqual(to.getTime());
  });
});
