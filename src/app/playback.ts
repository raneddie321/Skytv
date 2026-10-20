import type { MediaRef, PlaybackContent } from '@/api/contracts/domain';
import type { ProgressRecord } from '@/api/contracts/services';
import { latestForSeries } from '@/state/continueWatching';
import { movieProgressKey } from '@/state/library';

export interface PlayTarget {
  content: PlaybackContent;
  label: string;
  resume: boolean;
}

/** Decides what "Play" means for a title given the profile's progress (resume, up next, or from the start). */
export function resolvePlayTarget(media: Pick<MediaRef, 'id' | 'type'>, progress: Record<string, ProgressRecord>): PlayTarget {
  if (media.type === 'movie') {
    const p = progress[movieProgressKey(media.id)];
    const resume = !!p && !p.completed && p.positionSec > 30;
    return { content: { kind: 'movie', id: media.id }, label: resume ? 'Resume' : 'Play', resume };
  }
  const last = latestForSeries(progress, media.id);
  if (last?.episode) {
    if (last.completed && last.nextEpisode) {
      const e = last.nextEpisode;
      return {
        content: { kind: 'episode', seriesId: media.id, seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber },
        label: `Play S${e.seasonNumber} E${e.episodeNumber}`,
        resume: false,
      };
    }
    if (!last.completed) {
      const e = last.episode;
      return {
        content: { kind: 'episode', seriesId: media.id, seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber },
        label: `Resume S${e.seasonNumber} E${e.episodeNumber}`,
        resume: true,
      };
    }
  }
  return { content: { kind: 'episode', seriesId: media.id, seasonNumber: 1, episodeNumber: 1 }, label: 'Play S1 E1', resume: false };
}

export function minutesLeft(positionSec: number, durationSec: number): string {
  const left = Math.max(0, Math.round((durationSec - positionSec) / 60));
  return left >= 60 ? `${Math.floor(left / 60)}h ${left % 60}m left` : `${left}m left`;
}
