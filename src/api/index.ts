/**
 * Service factory. Chooses implementations from DATA_MODE / CATALOG_SOURCE (see src/config/env.ts).
 */
import { appConfig } from '@/config/env';
import { useCatalogStatus } from '@/state/catalogStatus';
import type { Services } from './contracts/services';
import { FixtureCatalog } from './fixtures/catalog';
import { FixtureLiveTv } from './fixtures/live';
import {
  createMockAuth,
  mockAccount,
  mockEntitlements,
  mockHistory,
  mockParental,
  mockPlayback,
  mockProfiles,
  mockSubscription,
  mockWatchlist,
} from './mock/services';
import { createRemoteServices } from './remote/services';
import { RoutedCatalog } from './routedCatalog';
import { TmdbCatalog } from './tmdb/catalog';

export function createServices(config = appConfig): Services {
  if (config.dataMode === 'remote') {
    return { mode: 'remote', ...createRemoteServices(config.apiBaseUrl) };
  }
  const fixtures = new FixtureCatalog(config.fixtureLatencyMs);
  const catalog =
    config.catalogSource === 'fixtures'
      ? fixtures
      : new RoutedCatalog(new TmdbCatalog({ proxyBase: config.tmdbProxyUrl }), fixtures, (active, error) =>
          useCatalogStatus.getState().setFallback(active, error),
        );
  const live = new FixtureLiveTv(config.fixtureLatencyMs);
  return {
    mode: 'mock',
    auth: createMockAuth(),
    account: mockAccount,
    subscription: mockSubscription,
    profiles: mockProfiles,
    catalog,
    search: catalog,
    recommendations: catalog,
    history: mockHistory,
    watchlist: mockWatchlist,
    live,
    epg: live,
    playback: mockPlayback,
    entitlements: mockEntitlements,
    parental: mockParental,
  };
}

let current: Services | null = null;

export function getServices(): Services {
  if (!current) current = createServices();
  return current;
}

/** Test hook. */
export function setServices(services: Services | null) {
  current = services;
}
