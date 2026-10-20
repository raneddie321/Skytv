/* Minimal service worker: cache-first for artwork (TMDB image CDN + demo art), network-first for TMDB proxy JSON. */
const IMG_CACHE = 'skytv-img-v1';
const API_CACHE = 'skytv-api-v1';
const MAX_IMAGES = 400;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![IMG_CACHE, API_CACHE].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isImage = url.hostname === 'image.tmdb.org' || url.pathname.startsWith('/demo-art/');
  if (isImage) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok || res.type === 'opaque') {
          cache.put(request, res.clone());
          trim(IMG_CACHE, MAX_IMAGES);
        }
        return res;
      }),
    );
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/tmdb/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(API_CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || Response.error())),
    );
  }
});
