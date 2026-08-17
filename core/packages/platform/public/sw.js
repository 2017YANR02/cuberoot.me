/* 魔方开放社群 service worker。手写,不依赖 workbox。 */

const STATIC_CACHE = "cube-static-v1";
const PAGES_CACHE = "cube-pages-v1";
const OFFLINE_URL = "/offline";
const PRECACHE = ["/", OFFLINE_URL, "/manifest.json"];

const STATIC_PATTERNS = [
  /^\/_next\/static\//,
  /^\/_next\/image/,
  /^\/uploads\//,
  /^\/icons\//,
  /^\/icon$/,
  /^\/apple-icon$/,
  /^\/favicon\.ico$/,
  /^\/manifest\.json$/,
];

const STATIC_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30d

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // 单个失败不阻塞其它
      await Promise.allSettled(PRECACHE.map((u) => cache.add(u)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticPath(pathname) {
  return STATIC_PATTERNS.some((re) => re.test(pathname));
}

function isApiPath(pathname) {
  return pathname.startsWith("/api/");
}

function isFresh(response) {
  const date = response.headers.get("date");
  if (!date) return true;
  const ts = Date.parse(date);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts < STATIC_MAX_AGE_MS;
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached && isFresh(cached)) return cached;
  try {
    const res = await fetch(request);
    if (res.ok && res.status === 200) {
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok && res.status === 200) {
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨域不接管

  if (isApiPath(url.pathname)) return; // API 不缓存

  if (isStaticPath(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // HTML 文档:network-first
  const accept = req.headers.get("accept") || "";
  if (req.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(networkFirstPage(req));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
