/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DATA_MODE?: 'mock' | 'remote';
  readonly CATALOG_SOURCE?: 'tmdb' | 'fixtures';
  readonly API_BASE_URL?: string;
  readonly TMDB_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
