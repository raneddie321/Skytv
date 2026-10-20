/** TanStack Query hooks over the service layer. Query keys are stable and include every input. */
import { QueryClient, keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Audience, MediaType, RailQuery } from './contracts/domain';
import type { CollectionEntry, FeaturedContext } from './contracts/services';
import { ApiError } from './http';
import { getServices } from './index';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => count < 2 && (!(error instanceof ApiError) || error.retriable),
        retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
      },
    },
  });
}

const svc = () => getServices();

export const useRail = (query: RailQuery, enabled = true) =>
  useQuery({ queryKey: ['rail', query], queryFn: () => svc().catalog.getRail(query), enabled });

export const useInfiniteRail = (query: Omit<RailQuery, 'page'>, enabled = true) =>
  useInfiniteQuery({
    queryKey: ['rail-infinite', query],
    queryFn: ({ pageParam }) => svc().catalog.getRail({ ...query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages && last.page < 10 ? last.page + 1 : undefined),
    enabled,
  });

export const useFeatured = (context: FeaturedContext) =>
  useQuery({ queryKey: ['featured', context], queryFn: () => svc().catalog.getFeatured(context) });

export const useGenres = (mediaType: MediaType, audience: Audience = 'all') =>
  useQuery({ queryKey: ['genres', mediaType, audience], queryFn: () => svc().catalog.getGenres(mediaType, audience), staleTime: 24 * 3600_000 });

export const useMovie = (id: string | undefined) =>
  useQuery({ queryKey: ['movie', id], queryFn: () => svc().catalog.getMovie(id!), enabled: !!id });

export const useSeries = (id: string | undefined) =>
  useQuery({ queryKey: ['series', id], queryFn: () => svc().catalog.getSeries(id!), enabled: !!id });

export const useSeason = (seriesId: string | undefined, seasonNumber: number | undefined) =>
  useQuery({
    queryKey: ['season', seriesId, seasonNumber],
    queryFn: () => svc().catalog.getSeason(seriesId!, seasonNumber!),
    enabled: !!seriesId && !!seasonNumber,
    placeholderData: keepPreviousData,
  });

export const useCollection = (key: string, entries: CollectionEntry[]) =>
  useQuery({ queryKey: ['collection', key, svc().catalog.source], queryFn: () => svc().catalog.resolveCollection(entries), staleTime: 3600_000 });

export const useSearch = (query: string, audience: Audience) =>
  useQuery({
    queryKey: ['search', query.trim().toLowerCase(), audience],
    queryFn: () => svc().search.search(query, { audience }),
    enabled: query.trim().length >= 1,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

export const useRecommendations = (seedIds: string[], audience: Audience) =>
  useQuery({
    queryKey: ['recommendations', seedIds, audience],
    queryFn: () => svc().recommendations.forProfile(seedIds.map((id) => ({ id })), audience),
    placeholderData: keepPreviousData,
  });

export const useSimilar = (id: string | undefined) =>
  useQuery({ queryKey: ['similar', id], queryFn: () => svc().recommendations.similarTo(id!), enabled: !!id });

export const useChannels = () =>
  useQuery({ queryKey: ['channels'], queryFn: () => svc().live.getChannels(), staleTime: 3600_000 });

/** Schedule window, aligned to 30-minute boundaries so the key is stable for a while. */
export function scheduleWindow(hoursBefore = 1, hoursAfter = 6, now = Date.now()) {
  const slot = 30 * 60_000;
  const start = Math.floor(now / slot) * slot - hoursBefore * 3600_000;
  return { from: new Date(start), to: new Date(start + (hoursBefore + hoursAfter) * 3600_000) };
}

export const useSchedule = (channelIds: string[] | undefined, from: Date, to: Date) =>
  useQuery({
    queryKey: ['schedule', channelIds, from.toISOString(), to.toISOString()],
    queryFn: () => svc().epg.getSchedule(channelIds!, from, to),
    enabled: !!channelIds?.length,
    refetchInterval: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

export const useAccount = () => useQuery({ queryKey: ['account'], queryFn: () => svc().account.getAccount() });
export const useSubscription = () => useQuery({ queryKey: ['subscription'], queryFn: () => svc().subscription.getSubscription() });
