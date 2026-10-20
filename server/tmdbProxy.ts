/**
 * Lightweight TMDB v3 proxy. Keeps TMDB_API_KEY on the server, restricts requests to read-only catalog endpoints,
 * caches responses in memory and coalesces identical in-flight requests.
 *   GET /api/tmdb/<tmdb path>?<query>   ->   https://api.themoviedb.org/3/<tmdb path>?<query>&api_key=***
 *   GET /api/tmdb/__status              ->   { configured, reachable, latencyMs }
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, type Next } from './http';

export interface TmdbProxyOptions {
  apiKey: string;
  upstream?: string;
  /** Default cache TTL in ms. */
  ttlMs?: number;
  maxEntries?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const ALLOWED = /^\/(trending|movie|tv|search|discover|genre|configuration)(\/[A-Za-z0-9_\-/]*)?$/;
const FORBIDDEN_PARAMS = new Set(['api_key', 'session_id', 'guest_session_id']);

interface CacheEntry {
  status: number;
  body: string;
  expires: number;
}

export function createTmdbProxy(options: TmdbProxyOptions) {
  const upstream = (options.upstream ?? 'https://api.themoviedb.org/3').replace(/\/$/, '');
  const ttl = options.ttlMs ?? 10 * 60_000;
  const maxEntries = options.maxEntries ?? 800;
  const timeoutMs = options.timeoutMs ?? 8000;
  const doFetch = options.fetchImpl ?? fetch;
  const cache = new Map<string, CacheEntry>();
  const inflight = new Map<string, Promise<CacheEntry>>();

  const ttlFor = (path: string) => (path.startsWith('/genre') || path.startsWith('/configuration') ? 24 * 3600_000 : ttl);

  async function fetchUpstream(path: string, query: URLSearchParams): Promise<CacheEntry> {
    const url = new URL(`${upstream}${path}`);
    query.forEach((v, k) => {
      if (!FORBIDDEN_PARAMS.has(k)) url.searchParams.set(k, v);
    });
    url.searchParams.set('api_key', options.apiKey);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await doFetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      const body = await r.text();
      return { status: r.status, body, expires: Date.now() + (r.ok ? ttlFor(path) : 30_000) };
    } finally {
      clearTimeout(timer);
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse, next?: Next) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/__status') {
      if (!options.apiKey) return sendJson(res, 200, { configured: false, reachable: false });
      const started = Date.now();
      try {
        const r = await fetchUpstream('/configuration', new URLSearchParams());
        return sendJson(res, 200, { configured: true, reachable: r.status === 200, status: r.status, latencyMs: Date.now() - started });
      } catch (e) {
        return sendJson(res, 200, { configured: true, reachable: false, error: (e as Error).message });
      }
    }

    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed', message: 'Only GET is supported' });
    if (!ALLOWED.test(path)) {
      if (next) return next();
      return sendJson(res, 404, { error: 'not_found', message: 'Endpoint not proxied' });
    }
    if (!options.apiKey) {
      return sendJson(res, 503, { error: 'tmdb_not_configured', message: 'TMDB_API_KEY is not set on the server' });
    }

    const params = new URLSearchParams(url.search);
    params.sort();
    const key = `${path}?${params.toString()}`;
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) {
      return writeEntry(res, hit, 'HIT');
    }
    try {
      let pending = inflight.get(key);
      if (!pending) {
        pending = fetchUpstream(path, params);
        inflight.set(key, pending);
        pending.finally(() => inflight.delete(key)).catch(() => undefined);
      }
      const entry = await pending;
      if (entry.status === 200) {
        cache.set(key, entry);
        if (cache.size > maxEntries) cache.delete(cache.keys().next().value as string);
      }
      writeEntry(res, entry, 'MISS');
    } catch (e) {
      const aborted = (e as Error).name === 'AbortError';
      sendJson(res, aborted ? 504 : 502, {
        error: aborted ? 'tmdb_timeout' : 'tmdb_unreachable',
        message: aborted ? 'TMDB did not respond in time' : 'TMDB could not be reached from the server',
      });
    }
  }

  function writeEntry(res: ServerResponse, entry: CacheEntry, cacheState: 'HIT' | 'MISS') {
    if (res.headersSent) return;
    res.writeHead(entry.status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': entry.status === 200 ? 'public, max-age=300' : 'no-store',
      'X-Cache': cacheState,
    });
    res.end(entry.body);
  }

  return (req: IncomingMessage, res: ServerResponse, next?: Next) => {
    handle(req, res, next).catch((e) => sendJson(res, 500, { error: 'proxy_error', message: (e as Error).message }));
  };
}
