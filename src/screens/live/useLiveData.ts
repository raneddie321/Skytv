import { useMemo } from 'react';
import type { Channel, ChannelCategory, Programme } from '@/api/contracts/domain';
import { scheduleWindow, useChannels, useSchedule } from '@/api/hooks';

export type CategoryFilter = ChannelCategory | 'all' | 'favourites';

export interface ChannelNow {
  channel: Channel;
  now?: Programme;
  next?: Programme;
  programmes: Programme[];
  progress: number;
}

export function programmeProgress(p: Programme | undefined, now = Date.now()) {
  if (!p) return 0;
  const s = Date.parse(p.start);
  const e = Date.parse(p.end);
  return Math.max(0, Math.min(1, (now - s) / Math.max(1, e - s)));
}

/** Channels + a schedule window, joined into "now / next" per channel and filtered by category. */
export function useLiveData(filter: CategoryFilter, favourites: string[], hoursAfter = 6) {
  const channels = useChannels();
  const range = useMemo(() => scheduleWindow(1, hoursAfter), [hoursAfter]);
  const ids = useMemo(() => channels.data?.map((c) => c.id), [channels.data]);
  const schedule = useSchedule(ids, range.from, range.to);

  const rows = useMemo<ChannelNow[]>(() => {
    const now = Date.now();
    return (channels.data ?? [])
      .filter((c) => (filter === 'all' ? true : filter === 'favourites' ? favourites.includes(c.id) : c.category === filter))
      .map((channel) => {
        const programmes = schedule.data?.[channel.id] ?? [];
        const idx = programmes.findIndex((p) => Date.parse(p.start) <= now && Date.parse(p.end) > now);
        const current = idx >= 0 ? programmes[idx] : undefined;
        return { channel, now: current, next: idx >= 0 ? programmes[idx + 1] : undefined, programmes, progress: programmeProgress(current, now) };
      });
  }, [channels.data, schedule.data, filter, favourites]);

  return {
    rows,
    range,
    loading: channels.isLoading || (!!ids?.length && schedule.isLoading),
    error: channels.isError || schedule.isError,
    retry: () => {
      void channels.refetch();
      void schedule.refetch();
    },
  };
}
