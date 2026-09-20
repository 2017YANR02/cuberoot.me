export const SITE_ICON_CACHE_STORAGE_PREFIX = 'cuberoot.site-icon.v2:';

export function siteIconSources(url: string): string[] {
  try {
    const parsed = new URL(url);
    const googleFallback = new URL('https://s2.googleusercontent.com/s2/favicons');
    googleFallback.searchParams.set('domain_url', parsed.origin);
    googleFallback.searchParams.set('sz', '64');
    googleFallback.searchParams.set('alt', '404');

    return [...new Set([
      new URL('/favicon.ico', parsed).href,
      googleFallback.href,
    ])];
  } catch {
    return [];
  }
}
