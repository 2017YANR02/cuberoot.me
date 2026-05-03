/// <reference lib="WebWorker" />
/**
 * Service Worker — 拦截 /api/visualcube.svg，本地用 renderCubeSVG 生成 SVG。
 *
 * 效果：
 * - <img src="/api/visualcube.svg?..."> 浏览器右键 "Copy image address" 拿到干净 URL
 * - SW 激活后不发真网络请求（本地生成）
 * - 离线 / ECS 挂掉也能出图（除首次访问）
 * - 首次访问 SW 还没装好 → 走真 server (`@cuberoot/server` 路由)
 *
 * 这个文件被 scripts/build-sw.mjs 用 esbuild bundle 成 public/sw.js（visualcube 内联）。
 */
import { renderCubeSVG, Masking, Face, type ICubeOptions } from '@cuberoot/visualcube';

declare const self: ServiceWorkerGlobalScope;

const DEFAULT_ALG = "R U R' U R U2 R'";
const DEFAULT_SIZE = 256;

const OLL_STAGE_SCHEME = {
  [Face.U]: '#FFFF00',
  [Face.D]: '#404040',
  [Face.F]: '#404040',
  [Face.B]: '#404040',
  [Face.L]: '#404040',
  [Face.R]: '#404040',
};

function findMask(name: string | null): Masking | undefined {
  if (!name) return undefined;
  const v = (Object.values(Masking) as string[]).find(m => m.toLowerCase() === name.toLowerCase());
  return v as Masking | undefined;
}

function buildOpts(params: URLSearchParams): ICubeOptions {
  const alg = params.get('alg') ?? DEFAULT_ALG;
  const view = params.get('view') ?? 'iso';
  const maskParam = params.get('mask');
  const sizeRaw = parseInt(params.get('size') ?? String(DEFAULT_SIZE), 10);
  const size = Math.max(32, Math.min(1000, isNaN(sizeRaw) ? DEFAULT_SIZE : sizeRaw));
  const bg = params.get('bg');

  const opts: ICubeOptions = { case: alg, width: size, height: size };
  if (bg) {
    if (/^#?[0-9a-f]{3,8}$/i.test(bg)) opts.backgroundColor = bg.startsWith('#') ? bg : '#' + bg;
    else if (/^[a-z]+$/i.test(bg)) opts.backgroundColor = bg;
  }

  const explicitMask = findMask(maskParam);
  if (explicitMask) opts.mask = explicitMask;
  else if (view === 'f2l') opts.mask = Masking.F2L;
  else if (view === 'oll') opts.mask = Masking.OLL;
  else if (view === 'pll') opts.mask = Masking.LL;
  else if (view === 'pll-iso') opts.mask = Masking.LL;

  if (view === 'plan' || view === 'oll' || view === 'pll') opts.view = 'plan';
  if (view === 'oll' && !explicitMask) opts.colorScheme = OLL_STAGE_SCHEME;

  return opts;
}

self.addEventListener('install', () => {
  // 立即激活新版本，跳过等待旧 SW unload
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 立即接管所有现存页面
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname !== '/api/visualcube.svg') return;

  event.respondWith((async () => {
    try {
      const svg = renderCubeSVG(buildOpts(url.searchParams));
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch {
      // 兜底：放行到真服务器
      return fetch(event.request);
    }
  })());
});

export {};
