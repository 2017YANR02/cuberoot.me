/**
 * 后端 API 基址。生产环境一律走 api.cuberoot.me 子域,本地 dev 走 vite proxy。
 *
 * 背景: cuberoot.me 走分线路 DNS — 境内 → 原服务器, 境外 → GitHub Pages。
 * GH Pages 不带后端,所以 SPA 不能用相对 /api/* (会 404),必须走独立 API 子域回源。
 */
export const API_ORIGIN = (() => {
  const override = import.meta.env.VITE_API_ORIGIN as string | undefined;
  if (override) return override;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (host === 'localhost' || host === '127.0.0.1') return ''; // dev: vite proxy 接 /api/*
  return 'https://api.cuberoot.me';
})();

/** 拼接 API 路径,e.g. apiUrl('/api/recon/list') */
export function apiUrl(path: string): string {
  return API_ORIGIN + path;
}
