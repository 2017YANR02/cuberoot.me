// Statistics share one policy with the person/competition loaders.
// NEXT_PUBLIC_STATIC_ORIGIN controls other assets only (models, music, tools).
export { statsUrl } from '@cuberoot/shared/stats-base';
const STATIC_ORIGIN = (() => {
  const override = process.env.NEXT_PUBLIC_STATIC_ORIGIN;
  if (override) return override;
  // Server-side (RSC / build-time prerender) must use an absolute origin.
  if (typeof window === 'undefined') return 'https://static.cuberoot.me';
  return process.env.NODE_ENV === 'development' ? '' : 'https://static.cuberoot.me';
})();

// Browser-facing counterpart of STATIC_ORIGIN, for <link rel="dns-prefetch">.
// See BROWSER_API_ORIGIN in lib/api-base for why the private const won't do.
export const BROWSER_STATIC_ORIGIN =
  process.env.NEXT_PUBLIC_STATIC_ORIGIN
  || (process.env.NODE_ENV === 'development' ? '' : 'https://static.cuberoot.me');

// Non-stats static-origin assets (e.g. /sim/hands/* MANO/SMPL-X rigs: prod
// serves them from static.cuberoot.me — not in git, uploaded to the server —
// dev from local public/). Independent of the statistics source.
export function staticUrl(path: string): string {
  return STATIC_ORIGIN + path;
}
