import { apiUrl } from './api-base';

export const PAGE_ACCESS_API_PATHS = {
  locks: '/v1/nav/home-locks',
  session: '/v1/auth/me',
} as const;

/** Production middleware runs globally; keep its origin connection in one region. */
export function pageAccessApiUrl(check: keyof typeof PAGE_ACCESS_API_PATHS): string {
  if (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production') {
    // This existing public production alias is Vercel-only. The custom domain
    // has split DNS and can resolve to the same origin that cannot be reached.
    return `https://cuberoot-me.vercel.app/api/page-access?check=${check}`;
  }
  // Preview middleware already runs in the project's configured region.
  // Standalone/dev keep using the original API directly.
  return apiUrl(PAGE_ACCESS_API_PATHS[check]);
}
