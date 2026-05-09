/// <reference lib="WebWorker" />
/**
 * Service Worker — 三件事:
 *   1. 拦截 /v1/visualcube.svg → 本地 renderFromSimpleQuery 出图(免后端)
 *   2. 给同源响应注入 COOP/COEP 让 SharedArrayBuffer 可用 — cubeopt-wasm 需要
 *   3. (Safari only) 跨源响应补 CORP=cross-origin,因为 Safari 不支持 COEP=credentialless
 *
 * COEP 选型:
 *   - Chrome / Firefox / Edge:credentialless — 允许跨源 no-CORP 资源(Google Fonts 等)
 *   - Safari:不支持 credentialless,只能用 require-corp。这要求所有跨源资源带 CORP,
 *     否则会被 block。SW 拦截跨源 GET、强制 mode='cors' 重 fetch、加 CORP 后回。
 *
 * 通过 SW 拦截 = 不需要改 server / 不需要 self-host fonts,跟 coi-serviceworker
 * 的 require-corp 模式一致。代价是 Safari 跨源资源走双跳 fetch(浏览器 → SW → 网),
 * 首次稍慢,但加了浏览器缓存后无感。
 *
 * 这个文件被 scripts/build_sw.mjs 用 esbuild bundle 成 public/sw.js。
 */
import { renderFromSimpleQuery } from '@cuberoot/visualcube';

declare const self: ServiceWorkerGlobalScope;

// 检测 Safari(在 SW 全局 navigator 上;这是浏览器进程层面的常量,不会变)
const ua = self.navigator.userAgent;
const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
const COEP_VALUE = isSafari ? 'require-corp' : 'credentialless';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function addCoiHeaders(response: Response): Response {
  if (response.status === 0) return response;
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Embedder-Policy', COEP_VALUE);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  // 同源响应也带 CORP=same-origin,Safari 在 require-corp 模式下要求
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Safari 专用:跨源响应改写。强制走 CORS fetch 拿到完整 body(原 no-cors 请求会
 * 返回 opaque,无法重组),加 CORP=cross-origin 让 require-corp 文档接受。
 *
 * 失败兜底:CORS fetch 抛错(目标服务器不支持 CORS)→ 透传原请求,资源可能仍被
 * COEP block,但至少不破坏其它逻辑。
 */
async function rewriteCrossOrigin(req: Request): Promise<Response> {
  try {
    const r = await fetch(req.url, { mode: 'cors', credentials: 'omit' });
    if (r.status === 0) return r;
    const headers = new Headers(r.headers);
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return new Response(r.body, {
      status: r.status,
      statusText: r.statusText,
      headers,
    });
  } catch {
    return fetch(req);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // /v1/visualcube.svg — local SVG render (existing)
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

  if (req.method !== 'GET') return;

  if (url.origin === self.location.origin) {
    // 同源:加 COI headers
    if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
    event.respondWith(
      fetch(req)
        .then(addCoiHeaders)
        .catch(() => fetch(req)),
    );
    return;
  }

  // 跨源:Safari 必须改写(加 CORP),其它浏览器 credentialless 模式不需要
  if (isSafari) {
    event.respondWith(rewriteCrossOrigin(req));
  }
});

export {};
