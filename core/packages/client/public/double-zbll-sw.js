/* Opt-in, narrowly scoped offline support for the public ZBLL trainer. */
const APP_CACHE = 'cuberoot-double-zbll-app-v1';
const DATA_CACHE = 'cuberoot-double-zbll-data-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/data/double-zbll/')) {
    event.respondWith(caches.open(DATA_CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
    return;
  }
  const page = request.mode === 'navigate' && url.href.startsWith(self.registration.scope)
    && /\/(run|select)\/?$/.test(url.pathname);
  const asset = /^\/(?:_next\/static\/|fonts\/|cubing-chunks\/)/.test(url.pathname);
  if (!page && !asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const key = page ? url.origin + url.pathname.replace(/\/$/, '') : request;
    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected) await cache.put(key, response.clone());
      return response;
    } catch (error) {
      const saved = await cache.match(key);
      if (saved) return saved;
      throw error;
    }
  })());
});
