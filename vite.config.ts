/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createTmdbProxy } from './server/tmdbProxy';
import { createMockApi } from './server/mockApi';

/** Mounts the TMDB proxy and the reference mock REST API on the Vite dev/preview servers. */
function apiMiddleware(env: Record<string, string>): Plugin {
  const tmdb = createTmdbProxy({
    apiKey: env.TMDB_API_KEY ?? '',
    upstream: env.TMDB_API_BASE || undefined,
  });
  const mockApi = env.ENABLE_MOCK_API === 'false' ? null : createMockApi();
  const mount = (server: { middlewares: { use: (p: string, h: never) => void } }) => {
    server.middlewares.use('/api/tmdb', tmdb as never);
    if (mockApi) server.middlewares.use('/api/v1', mockApi as never);
  };
  return {
    name: 'skytv-api-middleware',
    configureServer: mount,
    configurePreviewServer: mount,
  };
}

export default defineConfig(({ mode }) => {
  // Load every variable (empty prefix) for the server-side middleware only.
  const env = loadEnv(mode, process.cwd(), '');
  const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string };
  return {
    plugins: [react(), apiMiddleware(env)],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    // Only these prefixes reach the browser bundle. TMDB_API_KEY is deliberately excluded.
    envPrefix: ['VITE_', 'DATA_MODE', 'CATALOG_SOURCE', 'API_BASE_URL', 'TMDB_PROXY_URL'],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    build: {
      // Chromium 87+ covers webOS 22+, Tizen 6.5+ and evergreen Android TV WebViews.
      // See docs/PLATFORM_PACKAGING.md for older devices.
      target: ['chrome87', 'safari14'],
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            data: ['@tanstack/react-query', 'zustand'],
          },
        },
      },
    },
    server: { port: 5173, host: true },
    preview: { port: 4173, host: true },
    test: {
      environment: 'jsdom',
      include: ['tests/unit/**/*.test.{ts,tsx}'],
      setupFiles: ['tests/unit/setup.ts'],
      css: { modules: { classNameStrategy: 'non-scoped' } },
    },
  };
});
