/// <reference lib="WebWorker" />
/**
 * Service Worker — 两件事:
 *   1. 拦截 /v1/visualcube.svg → 本地 renderFromSimpleQuery 出图(免后端)
 *   2. 给所有同源响应注入 COOP/COEP 让 SharedArrayBuffer 可用 — 这样
 *      cubeopt-wasm (pthread) 在 GH Pages 上也跑得起来。
 *
 * COI = Cross-Origin Isolation。GH Pages 不让自定义 HTTP headers,
 * 只能走 service-worker 拦截响应再加头(coi-serviceworker 通行做法)。
 *
 * 跨源请求(api.cuberoot.me 等)不在本 SW scope 内,直接走原生 fetch,
 * 所以 API 调用不会被这层影响。
 *
 * 这个文件被 scripts/build-sw.mjs 用 esbuild bundle 成 public/sw.js。
 */
import { renderFromSimpleQuery } from '@cuberoot/visualcube';

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function addCoiHeaders(response: Response): Response {
  if (response.status === 0) return response;
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // /v1/visualcube.svg — local SVG render (existing).
  if (url.pathname === '/v1/visualcube.svg') {
    event.respondWith((async () => {
      try {
        const qs = url.searchParams;
        const svg = renderFromSimpleQuery({
          alg: qs.get('alg') ?? undefined,
          case: qs.get('case') ?? undefined,
          setup: qs.get('setup') ?? undefined,
          view: qs.get('view') ?? undefined,
          mask: qs.get('mask') ?? undefined,
          size: qs.get('size') ?? undefined,
          cubeSize: qs.get('cubeSize') ?? undefined,
          pzl: qs.get('pzl') ?? undefined,
          bg: qs.get('bg') ?? undefined,
          cc: qs.get('cc') ?? undefined,
          co: qs.get('co') ?? undefined,
        });
        return addCoiHeaders(new Response(svg, {
          headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
          },
        }));
      } catch {
        return fetch(req).then(addCoiHeaders);
      }
    })());
    return;
  }

  // COI 透传 — 仅同源 GET。其他请求(POST / 跨源)走原生网络,不动。
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

  event.respondWith(
    fetch(req)
      .then(addCoiHeaders)
      .catch(() => fetch(req)),
  );
});

export {};
