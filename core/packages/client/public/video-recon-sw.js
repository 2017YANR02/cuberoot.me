/* The video tool can reopen offline after its local runtime has been cached. */
const scope = new URL(self.registration.scope);
const path = scope.pathname.replace(/\/$/, '');
const locale = path.startsWith('/zh/') ? 'zh' : 'en';
const route = path.replace(/^\/(?:en|zh)(?=\/)/, '');
const cacheName = 'cuberoot-video-recon-v1';
const assetPath = /^\/(?:_next\/static\/|_origin\/_next\/static\/|fonts\/|cubing-chunks\/|vendor\/video-recon\/(?:models|pose|runtime|workers)\/)/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

function isAsset(url) {
  return url.origin === scope.origin && assetPath.test(url.pathname);
}

function cacheKey(url, shell = false) {
  // The static shell carries locale, while the client reads its mode from the URL.
  return shell ? scope.origin + path : url.href;
}

async function fetchAndCache(request, key, cache, shell = false) {
  const response = await fetch(request);
  if (response.ok && !response.redirected && (!shell || response.headers.get('content-type')?.includes('text/html'))) {
    try { await cache.put(key, response.clone()); } catch { /* Private browsing or quota limit. */ }
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin || request.headers.has('Range')) return;
  const shell = request.mode === 'navigate' && url.pathname.replace(/\/$/, '') === path;
  if (!shell && !isAsset(url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName).catch(() => undefined);
    if (!cache) return fetch(request);
    const key = cacheKey(url, shell);
    // Model URLs carry their content hash. Failures still fall through to the network.
    if (url.pathname.endsWith('.onnx')) {
      const saved = await cache.match(key);
      if (saved) return saved;
    }
    try {
      const response = await fetch(request);
      // The shell is only cached through the anonymous warm-up below.
      if (!shell && response.ok && !response.redirected) {
        event.waitUntil(cache.put(key, response.clone()).catch(() => {}));
      }
      return response;
    } catch (error) {
      const saved = await cache.match(key);
      if (saved) return saved;
      throw error;
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'PREPARE_VIDEO_RECON' || !event.source?.url || !Array.isArray(event.data.assets)) return;
  const sender = new URL(event.source.url);
  if (sender.origin !== scope.origin || sender.pathname.replace(/\/$/, '') !== path) return;
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    // Fetch the public locale shell with no cookies and without locale redirects.
    const shell = new URL(`/${locale}${route}`, scope);
    const html = await fetchAndCache(new Request(shell, { credentials: 'omit' }), cacheKey(shell, true), cache, true);
    const files = new Set(event.data.assets.filter(asset => typeof asset === 'string'));
    if (html.ok && html.headers.get('content-type')?.includes('text/html')) {
      const content = await html.text();
      for (const match of content.matchAll(/(?:src|href)=["']([^"']+)["']/g)) files.add(match[1]);
    }
    // Limit concurrent warmup so model initialization and rendering stay responsive.
    const assets = [...files].map(file => {
      try { return new URL(file, scope); } catch { return undefined; }
    }).filter(url => url && isAsset(url)).slice(0, 180);
    for (let index = 0; index < assets.length; index += 4) {
      await Promise.allSettled(assets.slice(index, index + 4).map(async url => {
        const key = cacheKey(url);
        if (!await cache.match(key)) await fetchAndCache(new Request(url, { credentials: 'omit' }), key, cache);
      }));
    }
  })().catch(() => { /* Online use does not depend on offline storage. */ }));
});
