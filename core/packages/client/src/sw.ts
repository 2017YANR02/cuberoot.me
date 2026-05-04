/// <reference lib="WebWorker" />
/**
 * Service Worker — 拦截 /api/visualcube.svg，本地用 renderFromSimpleQuery 生成 SVG。
 *
 * 效果：
 * - <img src="/api/visualcube.svg?..."> 浏览器右键 "Copy image address" 拿到干净 URL
 * - SW 激活后不发真网络请求（本地生成）
 * - 离线 / 后端挂掉也能出图（除首次访问）
 * - 首次访问 SW 还没装好 → 走真 server (`@cuberoot/server` 路由)
 *
 * view→mask / cubeSize / 颜色解析 全走 visualcube 包的 renderFromSimpleQuery，
 * 跟 vite dev middleware 和 Hono server 共享同一份 preset 映射，避免重复实现漂移
 * （历史上 SW 自己写了一份 buildOpts 漏读 pzl，4x4+ 预览全退化成 3x3）。
 *
 * 这个文件被 scripts/build-sw.mjs 用 esbuild bundle 成 public/sw.js（visualcube 内联）。
 */
import { renderFromSimpleQuery } from '@cuberoot/visualcube';

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname !== '/api/visualcube.svg') return;

  event.respondWith((async () => {
    try {
      const qs = url.searchParams;
      const svg = renderFromSimpleQuery({
        alg: qs.get('alg') ?? undefined,
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
      return fetch(event.request);
    }
  })());
});

export {};
