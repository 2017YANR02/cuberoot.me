// One policy for Web and shared loaders. Public snapshots come from the
// published server unless a developer explicitly opts into local statistics.
export const PUBLISHED_STATS_ORIGIN = 'https://static.cuberoot.me';

declare const process: { env: { NODE_ENV?: string; NEXT_PUBLIC_STATS_SOURCE?: string; PORT?: string } };

export function usesLocalStats(): boolean {
  try {
    // Keep literal accesses so Next can inline the public configuration.
    return process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_STATS_SOURCE === 'local';
  } catch {
    return false; // Other hosts without Node/Next use published data.
  }
}

export function statsUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!usesLocalStats()) return PUBLISHED_STATS_ORIGIN + p;
  if (typeof window !== 'undefined') return p;
  // Server-rendered development pages use the same local snapshot as browsers.
  // Production builds never depend on a running local server.
  return `http://127.0.0.1:${process.env.PORT || '3000'}${p}`;
}
