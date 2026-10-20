import { useEffect } from 'react';
import { getServices } from '@/api';
import { useCollection } from './hooks';
import { originalsConfig, registerOriginalIds, type OriginalsConfig } from '@/config/originals';
import type { CollectionEntry } from './contracts/services';

export function activeOriginalsConfig(): OriginalsConfig {
  return getServices().catalog.source === 'tmdb' ? originalsConfig.tmdb : originalsConfig.fixtures;
}

/** Resolves an editorial collection and registers its ids so cards can show the "original" mark. */
export function useOriginalsCollection(key: string, entries: CollectionEntry[]) {
  const query = useCollection(key, entries);
  useEffect(() => {
    if (query.data) registerOriginalIds(query.data.map((i) => i.id));
  }, [query.data]);
  return query;
}
