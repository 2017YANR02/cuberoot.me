/**
 * 后端 API 基址。生产环境一律走 api.cuberoot.me 子域,本地 dev 走 vite proxy。
 *
 * 背景: cuberoot.me 走分线路 DNS — 境内 → 原服务器, 境外 → GitHub Pages。
 * GH Pages 不带后端,所以 SPA 不能用相对 /v1/* (会 404),必须走独立 API 子域回源。
 */
export const API_ORIGIN = (() => {
  const override = import.meta.env.VITE_API_ORIGIN as string | undefined;
  if (override) return override;
  // Vite dev → 走相对路径(被 vite middleware/proxy 接住),避免 host=LAN IP 时
  // 跨域到 api.cuberoot.me。手机连 PC 的 dev server (192.168.x.x:5173) 跑的也是 dev,
  // 之前只判 localhost/127 会导致手机端 visualcube IMG 跨域失败 → 空图。
  if (import.meta.env.DEV) return '';
  return 'https://api.cuberoot.me';
})();

/** 拼接 API 路径,e.g. apiUrl('/v1/recon/list') */
export function apiUrl(path: string): string {
  return API_ORIGIN + path;
}
