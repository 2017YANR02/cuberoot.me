// Ported from packages/client/src/utils/api_base.ts.
// Next equivalent of import.meta.env.DEV is process.env.NODE_ENV.
// Override via NEXT_PUBLIC_API_ORIGIN (NEXT_PUBLIC_* is inlined into the client bundle).

export const API_ORIGIN = (() => {
  const override = process.env.NEXT_PUBLIC_API_ORIGIN;
  if (override) return override;
  // Server-side (RSC / route handlers) must ALWAYS use an absolute origin. A
  // relative '/v1/...' has no base in Node, and worse — Next resolves it to the
  // dev server's own origin, so a server component fetching it deadlocks the
  // single dev render worker (it's busy rendering the very page that's waiting
  // on the fetch → stuck "Rendering" forever). Dev has no local backend (/v1 is
  // proxied to prod), so server code hits the prod API directly even in dev.
  if (typeof window === 'undefined') return 'https://api.cuberoot.me';
  // Client in dev: relative path so next.config rewrites proxy /v1 → prod API
  // (avoids CORS from 127.0.0.1). Client in prod: absolute.
  return process.env.NODE_ENV === 'development' ? '' : 'https://api.cuberoot.me';
})();

export function apiUrl(path: string): string {
  return API_ORIGIN + path;
}
