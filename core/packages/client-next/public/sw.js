// Kill-switch service worker.
//
// The retired Vite app (packages/client) registered a service worker at /sw.js
// — a visualcube SVG generator. The current Next app registers NO service
// worker, but stale Vite-era clients still have the old one installed and keep
// polling /sw.js on every navigation. The server now returns a 404 HTML page
// (not valid JS), so the browser rejects the "update", keeps the old SW, and
// retries forever — a 404 never unregisters a SW. That is the /sw.js 404 storm.
//
// This file is valid JS, so a stale client's update check installs it; the
// install/activate then tears everything down: clear any caches, unregister
// self, and reload the controlled tabs onto a clean, SW-free session. There is
// intentionally NO fetch handler — the whole point is to stop intercepting.
//
// Placement: served at /sw.js (site root) on BOTH deploy lines — Next serves
// public/* at the web root on Vercel, and the standalone bundle carries it for
// the self-hosted nginx line (location / → :3002). Cache-Control: no-cache is
// set in next.config.ts headers() so it propagates within the 24h SW update cap.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        // no Cache Storage in the old SW; ignore
      }
      try {
        await self.registration.unregister();
      } catch {
        // ignore
      }
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        try {
          client.navigate(client.url);
        } catch {
          // ignore tabs that can't be navigated
        }
      }
    })(),
  );
});
