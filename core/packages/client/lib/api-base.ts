// Ported from packages/client-vite/src/utils/api_base.ts.
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

// For STREAMING (SSE) endpoints, always hit the API origin directly — even in
// dev. The Next dev rewrite proxy BUFFERS SSE (it holds every byte until the
// upstream stream closes), so live progress events + the keep-alive heartbeat
// never reach the browser and a long solve trips the no-response timeout. Going
// straight to the API streams unbuffered; CORS allows http://localhost:3000 to
// call api.cuberoot.me directly, so this is safe in dev. In prod it's identical
// to apiUrl() (already absolute). Use this for any fetch that reads an SSE body.
export function streamApiUrl(path: string): string {
  return (process.env.NEXT_PUBLIC_API_ORIGIN || 'https://api.cuberoot.me') + path;
}
