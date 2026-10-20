import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EpisodeRef, MediaRef, MediaSummary } from '@/api/contracts/domain';
import type { ProgressRecord } from '@/api/contracts/services';
import { persistStorage, STORAGE_PREFIX } from './storage';

export interface ProfileLibrary {
  watchlist: MediaRef[];
  progress: Record<string, ProgressRecord>;
  recentSearches: string[];
  favouriteChannels: string[];
}

const emptyLibrary = (): ProfileLibrary => ({ watchlist: [], progress: {}, recentSearches: [], favouriteChannels: [] });

interface LibraryState {
  byProfile: Record<string, ProfileLibrary>;
  toggleWatchlist: (profileId: string, item: MediaRef) => boolean;
  removeFromWatchlist: (profileId: string, id: string) => void;
  saveProgress: (profileId: string, record: ProgressRecord) => void;
  removeProgress: (profileId: string, key: string) => void;
  addRecentSearch: (profileId: string, query: string) => void;
  clearRecentSearches: (profileId: string) => void;
  toggleFavouriteChannel: (profileId: string, channelId: string) => void;
  replaceLibrary: (profileId: string, patch: Partial<ProfileLibrary>) => void;
  removeProfileData: (profileId: string) => void;
}

export const toMediaRef = (m: Pick<MediaSummary, 'id' | 'type' | 'title' | 'posterUrl' | 'backdropUrl' | 'year' | 'titleStyle' | 'kidsSafe'>): MediaRef => ({
  id: m.id,
  type: m.type,
  title: m.title,
  posterUrl: m.posterUrl,
  backdropUrl: m.backdropUrl,
  year: m.year,
  titleStyle: m.titleStyle,
  kidsSafe: m.kidsSafe,
});

export const movieProgressKey = (id: string) => `movie:${id}`;
export const episodeProgressKey = (seriesId: string, season: number, episode: number) => `episode:${seriesId}:${season}:${episode}`;

/** A title counts as finished in the last 5% (or final 2 minutes for longer content). */
export function isCompleted(positionSec: number, durationSec: number): boolean {
  if (!durationSec) return false;
  return positionSec >= durationSec - Math.min(120, durationSec * 0.05);
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => {
      const patch = (profileId: string, fn: (lib: ProfileLibrary) => Partial<ProfileLibrary>) => {
        const lib = get().byProfile[profileId] ?? emptyLibrary();
        set({ byProfile: { ...get().byProfile, [profileId]: { ...lib, ...fn(lib) } } });
      };
      return {
        byProfile: {},
        toggleWatchlist: (profileId, item) => {
          const exists = (get().byProfile[profileId]?.watchlist ?? []).some((w) => w.id === item.id);
          patch(profileId, (lib) => ({
            watchlist: exists ? lib.watchlist.filter((w) => w.id !== item.id) : [item, ...lib.watchlist].slice(0, 200),
          }));
          return !exists;
        },
        removeFromWatchlist: (profileId, id) => patch(profileId, (lib) => ({ watchlist: lib.watchlist.filter((w) => w.id !== id) })),
        saveProgress: (profileId, record) =>
          patch(profileId, (lib) => {
            const progress = { ...lib.progress, [record.key]: record };
            // Keep the store bounded: retain the 300 most recent records.
            const keys = Object.keys(progress);
            if (keys.length > 300) {
              keys
                .sort((a, b) => progress[a].updatedAt.localeCompare(progress[b].updatedAt))
                .slice(0, keys.length - 300)
                .forEach((k) => delete progress[k]);
            }
            return { progress };
          }),
        removeProgress: (profileId, key) =>
          patch(profileId, (lib) => {
            const progress = { ...lib.progress };
            delete progress[key];
            return { progress };
          }),
        addRecentSearch: (profileId, query) => {
          const q = query.trim();
          if (q.length < 2) return;
          patch(profileId, (lib) => ({
            recentSearches: [q, ...lib.recentSearches.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 8),
          }));
        },
        clearRecentSearches: (profileId) => patch(profileId, () => ({ recentSearches: [] })),
        toggleFavouriteChannel: (profileId, channelId) =>
          patch(profileId, (lib) => ({
            favouriteChannels: lib.favouriteChannels.includes(channelId)
              ? lib.favouriteChannels.filter((c) => c !== channelId)
              : [...lib.favouriteChannels, channelId],
          })),
        replaceLibrary: (profileId, p) => patch(profileId, () => p),
        removeProfileData: (profileId) => {
          const next = { ...get().byProfile };
          delete next[profileId];
          set({ byProfile: next });
        },
      };
    },
    { name: `${STORAGE_PREFIX}library`, storage: persistStorage, version: 1 },
  ),
);

const EMPTY = emptyLibrary();
export const useProfileLibrary = (profileId: string | null | undefined): ProfileLibrary =>
  useLibrary((s) => (profileId ? s.byProfile[profileId] : undefined) ?? EMPTY);

export type { EpisodeRef };
