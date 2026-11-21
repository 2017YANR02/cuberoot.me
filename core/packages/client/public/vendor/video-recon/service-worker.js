/* Retire the former iframe's service worker and only its scoped asset cache. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(Promise.allSettled([
    caches.delete(`magic-stew-assets-v1:${new URL(self.registration.scope).pathname}`),
    self.registration.unregister(),
  ]));
});
