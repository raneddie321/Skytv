import type { EpisodeRef, MediaRef } from '@/api/contracts/domain';
import type { ProgressRecord } from '@/api/contracts/services';

export interface ContinueWatchingItem {
  key: string;
  media: MediaRef;
  episode?: EpisodeRef;
  /** 0..1 */
  progress: number;
  positionSec: number;
  durationSec: number;
  /** True when this entry is the next episode after a finished one. */
  isUpNext: boolean;
  updatedAt: string;
}

/**
 * Derives the Continue Watching row from raw progress records:
 *  - one entry per series (the most recently watched episode);
 *  - a finished episode is replaced by its next episode ("Up next") when known;
 *  - finished movies and finished series without a known next episode are dropped;
 *  - items with less than 1% progress are ignored (accidental starts);
 *  - most recent first.
 */
export function deriveContinueWatching(records: Record<string, ProgressRecord>, limit = 20): ContinueWatchingItem[] {
  const latestByMedia = new Map<string, ProgressRecord>();
  for (const r of Object.values(records)) {
    const current = latestByMedia.get(r.media.id);
    if (!current || r.updatedAt > current.updatedAt) latestByMedia.set(r.media.id, r);
  }
  const out: ContinueWatchingItem[] = [];
  for (const r of latestByMedia.values()) {
    const progress = r.durationSec > 0 ? Math.min(1, r.positionSec / r.durationSec) : 0;
    if (r.completed) {
      if (r.media.type === 'tv' && r.nextEpisode) {
        out.push({
          key: `${r.media.id}:next`,
          media: r.media,
          episode: r.nextEpisode,
          progress: 0,
          positionSec: 0,
          durationSec: (r.nextEpisode.runtimeMinutes ?? 0) * 60,
          isUpNext: true,
          updatedAt: r.updatedAt,
        });
      }
      continue;
    }
    if (progress < 0.01) continue;
    out.push({
      key: r.key,
      media: r.media,
      episode: r.episode,
      progress,
      positionSec: r.positionSec,
      durationSec: r.durationSec,
      isUpNext: false,
      updatedAt: r.updatedAt,
    });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

/** Most recent progress record for a series (used for "Resume S2 E3" on the detail screen). */
export function latestForSeries(records: Record<string, ProgressRecord>, seriesId: string): ProgressRecord | undefined {
  return Object.values(records)
    .filter((r) => r.media.id === seriesId && r.episode)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}
