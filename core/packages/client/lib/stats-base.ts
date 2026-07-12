// Stats JSON live at repo-root /stats/*. On the self-hosted line nginx serves
// them directly; on Vercel they aren't bundled, so a relative /stats/* hits the
// route handler which 307-redirects to static.cuberoot.me — an extra edge
// request per fetch. Point prod fetches straight at static.cuberoot.me to skip
// the hop. Dev stays relative (the /stats route handler serves local repo files).
// Override via NEXT_PUBLIC_STATIC_ORIGIN (NEXT_PUBLIC_* is inlined into the client bundle).
const STATIC_ORIGIN = (() => {
  const override = process.env.NEXT_PUBLIC_STATIC_ORIGIN;
  if (override) return override;
  // Server-side (RSC / build-time prerender) must use an absolute origin.
  if (typeof window === 'undefined') return 'https://static.cuberoot.me';
  return process.env.NODE_ENV === 'development' ? '' : 'https://static.cuberoot.me';
})();

// Accepts a full '/stats/...' path (or a bare 'foo.json'); returns the origin-
// qualified URL. Prod → https://static.cuberoot.me/stats/...; dev → /stats/...
export function statsUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return STATIC_ORIGIN + p;
}

// Non-stats static-origin assets (e.g. /sim/hands/* MANO/SMPL-X rigs: prod
// serves them from static.cuberoot.me — not in git, uploaded to the server —
// dev from local public/). Same origin logic as statsUrl.
export function staticUrl(path: string): string {
  return STATIC_ORIGIN + path;
}
