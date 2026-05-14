/// <reference lib="WebWorker" />
/**
 * Service Worker — 一件事:
 *   /v1/visualcube.svg → 本地 renderFromSimpleQuery 出图(免后端,且 4 处客户端代码已用)
 *
 * 历史:之前还兼任全站 COOP/COEP 注入(让 cubeopt-wasm 拿到 SharedArrayBuffer)
 * + Safari 跨源响应改写(因 Safari 不支持 COEP=credentialless,必须 require-corp,
 * 只能拦截每个跨源响应补 CORP=cross-origin)。
 *
 * 2026-05-10 改成 nginx 直接发 COOP/COEP,且仅给 /scramble/(solver|analyzer) 发,
 * 见 ops/nginx/www.cuberoot.me.conf 的 map $request_uri 块。SW 里 COI 注入 +
 * Safari 改写两段全删:登录回调 /me 不再被 SW 吞 Authorization,Safari 用户也不
 * 用首次刷新等 SW install,WCA OAuth 跨源 fetch 直接通。
 *
 * 这个文件被 scripts/build_sw.mjs 用 esbuild bundle 成 public/sw.js。
 */
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
import { renderSq1ScrambleSvg, DEFAULT_SQ1_COLORS, invertSq1Alg } from './pages/gen/sq1_svg';
import { renderMegaScrambleSvg, DEFAULT_MEGA_COLORS } from './pages/gen/mega_svg';

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.pathname !== '/v1/visualcube.svg') return;

  event.respondWith((async () => {
    try {
      const qs = url.searchParams;
      const puzzle = (qs.get('puzzle') ?? 'cube').toLowerCase();

      // sq1 / megaminx (variant=net) — local tnoodle port, same renderer as
      // /visualcube?puzzle=sq1&variant=net + /alg/sq1 thumbnails.
      if (puzzle === 'sq1' || puzzle === 'megaminx') {
        const setupRaw = qs.get('setup');
        const caseRaw = qs.get('case');
        const algRaw = qs.get('alg');
        const forward = setupRaw ?? algRaw ?? (caseRaw != null
          ? (puzzle === 'sq1' ? invertSq1Alg(caseRaw) : caseRaw)
          : '');
        const svg = puzzle === 'sq1'
          ? renderSq1ScrambleSvg(forward, DEFAULT_SQ1_COLORS)
          : renderMegaScrambleSvg(forward, DEFAULT_MEGA_COLORS);
        return new Response(svg, {
          headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

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
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch {
      return fetch(req);
    }
  })());
});

export {};
