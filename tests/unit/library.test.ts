import { beforeEach, describe, expect, it } from 'vitest';
import type { ProgressRecord } from '@/api/contracts/services';
import { resolvePlayTarget } from '@/app/playback';
import { deriveContinueWatching } from '@/state/continueWatching';
import { episodeProgressKey, isCompleted, movieProgressKey, useLibrary } from '@/state/library';
import { useProfiles } from '@/state/profiles';

const series = { id: 'demo:tv:kingsgate', type: 'tv' as const, title: 'Kingsgate' };
const movie = { id: 'demo:movie:ember-city', type: 'movie' as const, title: 'Ember City' };
const ep = (s: number, e: number) => ({ id: `x:s${s}e${e}`, seasonNumber: s, episodeNumber: e, title: `E${e}` });

function rec(partial: Partial<ProgressRecord> & Pick<ProgressRecord, 'key' | 'media'>): ProgressRecord {
  return { positionSec: 600, durationSec: 3000, completed: false, updatedAt: '2026-10-20T10:00:00.000Z', ...partial };
}

describe('watchlist persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    useLibrary.setState({ byProfile: {} });
  });

  it('toggles per profile and persists to localStorage', () => {
    const added = useLibrary.getState().toggleWatchlist('p1', movie);
    expect(added).toBe(true);
    expect(useLibrary.getState().byProfile.p1.watchlist).toHaveLength(1);
    expect(useLibrary.getState().byProfile.p2).toBeUndefined();
    const stored = JSON.parse(localStorage.getItem('skytv.library')!);
    expect(stored.state.byProfile.p1.watchlist[0].id).toBe(movie.id);
    expect(useLibrary.getState().toggleWatchlist('p1', movie)).toBe(false);
    expect(useLibrary.getState().byProfile.p1.watchlist).toHaveLength(0);
  });

  it('keeps recent searches unique and bounded', () => {
    const { addRecentSearch } = useLibrary.getState();
    ['king', 'solar', 'KING', 'a'].forEach((q) => addRecentSearch('p1', q));
    expect(useLibrary.getState().byProfile.p1.recentSearches).toEqual(['KING', 'solar']);
  });
});

describe('profiles store', () => {
  it('creates, edits, selects and removes profiles', () => {
    const p = useProfiles.getState().create({ name: '  Grandma  ', avatarId: 'gold', kind: 'adult' });
    expect(p.name).toBe('Grandma');
    useProfiles.getState().select(p.id);
    expect(useProfiles.getState().activeProfileId).toBe(p.id);
    useProfiles.getState().update(p.id, { name: 'Nana' });
    expect(useProfiles.getState().profiles.find((x) => x.id === p.id)?.name).toBe('Nana');
    useProfiles.getState().remove(p.id);
    expect(useProfiles.getState().activeProfileId).toBeNull();
  });
});

describe('continue watching', () => {
  it('keeps one entry per series, newest first, and skips accidental starts', () => {
    const items = deriveContinueWatching({
      a: rec({ key: episodeProgressKey(series.id, 1, 1), media: series, episode: ep(1, 1), updatedAt: '2026-10-20T09:00:00.000Z' }),
      b: rec({ key: episodeProgressKey(series.id, 1, 2), media: series, episode: ep(1, 2), updatedAt: '2026-10-20T11:00:00.000Z' }),
      c: rec({ key: movieProgressKey(movie.id), media: movie, updatedAt: '2026-10-20T10:00:00.000Z' }),
      d: rec({ key: movieProgressKey('demo:movie:other'), media: { ...movie, id: 'demo:movie:other' }, positionSec: 5 }),
    });
    expect(items.map((i) => i.media.id)).toEqual([series.id, movie.id]);
    expect(items[0].episode?.episodeNumber).toBe(2);
  });

  it('replaces a finished episode with the next one and drops finished movies', () => {
    const items = deriveContinueWatching({
      a: rec({ key: 'k1', media: series, episode: ep(1, 8), nextEpisode: ep(2, 1), completed: true, positionSec: 3000 }),
      b: rec({ key: 'k2', media: movie, completed: true, positionSec: 3000 }),
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ isUpNext: true, progress: 0 });
    expect(items[0].episode).toMatchObject({ seasonNumber: 2, episodeNumber: 1 });
  });

  it('treats the last 5% (max 2 minutes) as completed', () => {
    expect(isCompleted(2900, 3000)).toBe(true);
    expect(isCompleted(2700, 3000)).toBe(false);
    expect(isCompleted(95, 100)).toBe(true);
  });

  it('resolves Play into resume / next / first episode', () => {
    expect(resolvePlayTarget(series, {}).content).toEqual({ kind: 'episode', seriesId: series.id, seasonNumber: 1, episodeNumber: 1 });
    const resuming = resolvePlayTarget(series, { a: rec({ key: 'a', media: series, episode: ep(2, 3) }) });
    expect(resuming).toMatchObject({ label: 'Resume S2 E3', resume: true });
    const next = resolvePlayTarget(series, { a: rec({ key: 'a', media: series, episode: ep(2, 3), nextEpisode: ep(2, 4), completed: true }) });
    expect(next.label).toBe('Play S2 E4');
    expect(resolvePlayTarget(movie, { [movieProgressKey(movie.id)]: rec({ key: movieProgressKey(movie.id), media: movie }) }).label).toBe('Resume');
  });
});
