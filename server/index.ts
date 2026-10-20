/**
 * Production server: serves the built frontend (dist/), the TMDB proxy and (optionally) the reference mock API.
 *   npm run build && npm start
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockApi } from './mockApi';
import { createTmdbProxy } from './tmdbProxy';
import { sendJson } from './http';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(root, '.env'));

const PORT = Number(process.env.PORT ?? 8080);
const DIST = path.join(root, 'dist');
const tmdb = createTmdbProxy({ apiKey: process.env.TMDB_API_KEY ?? '', upstream: process.env.TMDB_API_BASE || undefined });
const mockApi = process.env.ENABLE_MOCK_API === 'false' ? null : createMockApi();

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.vtt': 'text/vtt; charset=utf-8',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (url.pathname === '/healthz') return sendJson(res, 200, { ok: true });
  if (url.pathname.startsWith('/api/tmdb/') || url.pathname === '/api/tmdb') {
    req.url = url.pathname.slice('/api/tmdb'.length) + url.search;
    return tmdb(req, res);
  }
  if (mockApi && url.pathname.startsWith('/api/v1/')) {
    req.url = url.pathname.slice('/api/v1'.length) + url.search;
    return mockApi(req, res);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method_not_allowed' });

  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST)) return sendJson(res, 400, { error: 'bad_path' });
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html'); // SPA fallback
  const ext = path.extname(file);
  const size = statSync(file).size;
  const immutable = url.pathname.startsWith('/assets/');
  res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
  res.setHeader('Accept-Ranges', 'bytes');

  // Range requests are required for progressive video seeking on most TV browsers.
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      return res.end();
    }
    res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Length': size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Sky Stream Demo listening on http://localhost:${PORT}`);
  console.log(`  TMDB proxy: ${process.env.TMDB_API_KEY ? 'configured' : 'NOT configured (set TMDB_API_KEY)'}`);
  console.log(`  Mock REST API: ${mockApi ? '/api/v1' : 'disabled'}`);
});

function loadDotEnv(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
