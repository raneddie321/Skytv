// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTmdbProxy } from '../../server/tmdbProxy';

let server: Server | null = null;
async function start(handler: ReturnType<typeof createTmdbProxy>) {
  server = createServer((req, res) => handler(req, res));
  await new Promise<void>((r) => server!.listen(0, r));
  const { port } = server.address() as { port: number };
  return `http://127.0.0.1:${port}`;
}
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

describe('TMDB proxy', () => {
  it('injects the server-side key, strips client keys and caches responses', async () => {
    const upstream = vi.fn(async () => new Response(JSON.stringify({ page: 1, results: [] }), { status: 200 }));
    const base = await start(createTmdbProxy({ apiKey: 'SECRET', fetchImpl: upstream as unknown as typeof fetch }));
    const r1 = await fetch(`${base}/movie/popular?language=en-GB&api_key=evil`);
    expect(r1.status).toBe(200);
    expect(r1.headers.get('x-cache')).toBe('MISS');
    const calledUrl = String((upstream.mock.calls[0] as unknown[])[0]);
    expect(calledUrl).toContain('api_key=SECRET');
    expect(calledUrl).not.toContain('evil');
    const r2 = await fetch(`${base}/movie/popular?language=en-GB`);
    expect(r2.headers.get('x-cache')).toBe('HIT');
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('only proxies read-only catalog endpoints', async () => {
    const base = await start(createTmdbProxy({ apiKey: 'K', fetchImpl: vi.fn() as unknown as typeof fetch }));
    expect((await fetch(`${base}/account/123`)).status).toBe(404);
    expect((await fetch(`${base}/movie/popular`, { method: 'POST' })).status).toBe(405);
  });

  it('reports a missing key and unreachable upstream clearly', async () => {
    let base = await start(createTmdbProxy({ apiKey: '' }));
    const r = await fetch(`${base}/movie/popular`);
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ error: 'tmdb_not_configured' });
    await new Promise<void>((res) => server!.close(() => res()));
    server = null;
    base = await start(createTmdbProxy({ apiKey: 'K', fetchImpl: (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch }));
    const r2 = await fetch(`${base}/trending/all/week`);
    expect(r2.status).toBe(502);
    expect(await r2.json()).toMatchObject({ error: 'tmdb_unreachable' });
  });
});
