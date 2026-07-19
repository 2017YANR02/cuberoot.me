// Origin resolver for pre-generated stats JSON (repo-root /stats/*).
//
// On the self-hosted line nginx serves /stats/ directly; on Vercel they aren't
// bundled, so a relative /stats/* hits the Next route handler which
// 307-redirects to static.cuberoot.me — an extra edge request per fetch. Point
// prod fetches straight at static.cuberoot.me (CORS: *) to skip the hop. Dev
// stays relative (the /stats route handler serves the local repo files).
//
// Dev detection mirrors loadAlg() in ../alg.ts: Next/Webpack/Turbopack replace
// `process.env.NODE_ENV` as a string literal at build time; guarded for the
// browser bundles where `process` is undefined. `shared/` can't import the
// client `lib/` helpers, so this is the shared-local equivalent of
// client's lib/stats-base.ts.
declare const process: { env: { NODE_ENV?: string } };
function nodeProcessEnv(): string | undefined {
  return process.env.NODE_ENV;
}

function isDev(): boolean {
  let nodeEnv: string | undefined;
  try { nodeEnv = nodeProcessEnv(); } catch { /* not in Node/bundler context */ }
  return nodeEnv === 'development';
}

/** Origin-qualify a '/stats/...' path. Prod → static.cuberoot.me; dev → relative. */
export function statsUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return isDev() ? p : `https://static.cuberoot.me${p}`;
}
