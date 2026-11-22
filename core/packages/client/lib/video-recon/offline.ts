import { VIDEO_RECON_ASSETS } from './engine/worker-assets';

const preparedScopes = new Map<string, Promise<void>>();

/** Scope the offline shell to the current video tool route. */
export function prepareOfflineVideoRecon() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator) || !window.isSecureContext) {
    return Promise.resolve();
  }
  const scope = location.pathname.replace(/\/$/, '');
  if (!/^\/(?:en\/|zh\/)?(?:frame-count|video-recon)$/.test(scope)) return Promise.resolve();
  const existing = preparedScopes.get(scope);
  if (existing) return existing;
  const pending = prepare(scope).catch(() => { preparedScopes.delete(scope); });
  preparedScopes.set(scope, pending);
  return pending;
}

async function prepare(scope: string) {
  const script = new URL('/video-recon-sw.js', location.origin);
  const registration = await navigator.serviceWorker.register(script, { scope });
  // The first visit's model requests should already be under the new cache.
  if (navigator.serviceWorker.controller?.scriptURL !== script.href) {
    await new Promise<void>(resolve => {
      const finish = () => {
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener('controllerchange', check);
        resolve();
      };
      const check = () => { if (navigator.serviceWorker.controller?.scriptURL === script.href) finish(); };
      const timeout = setTimeout(finish, 2000);
      navigator.serviceWorker.addEventListener('controllerchange', check);
      check();
    });
  }

  const collect = async () => {
    const resources = performance.getEntriesByType('resource').map(entry => entry.name).reverse();
    const manifest = await fetch(`${VIDEO_RECON_ASSETS}workers/assets.json`).catch(() => undefined);
    if (manifest?.ok) {
      const files: string[] = await manifest.json();
      resources.unshift(...files.map(file => `${VIDEO_RECON_ASSETS}${file}`));
    }
    const worker = registration.active;
    if (worker) worker.postMessage({ type: 'PREPARE_VIDEO_RECON', assets: resources });
  };
  void collect().catch(() => {});
}
