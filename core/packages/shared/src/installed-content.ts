/** First App release exclusions approved by the owner; normal website unchanged. */
export function installedContentUnavailable(href: string): boolean {
  try {
    const url = new URL(href, 'https://cuberoot.me');
    if (!['cuberoot.me', 'www.cuberoot.me', 'dev.cuberoot.me', 'localhost', '127.0.0.1'].includes(url.hostname)) return false;
    const path = decodeURIComponent(url.pathname).replace(/^\/zh(?=\/|$)/, '').replace(/\/+$/, '');
    return path === '/music' || path.startsWith('/music/')
      || path === '/alg/sq1/pbl' || path.startsWith('/alg/sq1/pbl/')
      || path === '/alg/sq1/pbl-finder' || path.startsWith('/alg/sq1/pbl-finder/')
      || path === '/alg/sq1/karnaukh-notation' || path.startsWith('/alg/sq1/karnaukh-notation/')
      || (path.startsWith('/pets') && url.searchParams.get('pet') === 'clawd');
  } catch { return true; }
}
