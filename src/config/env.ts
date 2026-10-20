/** Build-time client configuration. See .env.example. Never put secrets here: everything is shipped to the browser. */
export type DataMode = 'mock' | 'remote';
export type CatalogSource = 'tmdb' | 'fixtures';

const env = import.meta.env;

export const appConfig = {
  dataMode: (env.DATA_MODE === 'remote' ? 'remote' : 'mock') as DataMode,
  catalogSource: (env.CATALOG_SOURCE === 'fixtures' ? 'fixtures' : 'tmdb') as CatalogSource,
  apiBaseUrl: env.API_BASE_URL || '/api/v1',
  tmdbProxyUrl: env.TMDB_PROXY_URL || '/api/tmdb',
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
  buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString(),
  /** Simulated latency for the offline catalog so skeleton states are visible during development. */
  fixtureLatencyMs: env.MODE === 'test' ? 0 : 180,
};
