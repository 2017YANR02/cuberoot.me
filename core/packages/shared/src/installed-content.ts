/** First App release exclusions approved by the owner; normal website unchanged. */
export function installedContentUnavailable(href: string, generativeAiDisabled = false): boolean {
  try {
    const url = new URL(href, 'https://cuberoot.me');
    if (!['cuberoot.me', 'www.cuberoot.me', 'dev.cuberoot.me', 'localhost', '127.0.0.1'].includes(url.hostname)) return false;
    const path = decodeURIComponent(url.pathname).replace(/^\/(?:en|zh)(?=\/|$)/, '').replace(/\/+$/, '');
    if (generativeAiDisabled && (path === '/chat' || path.startsWith('/chat/'))) return true;
    return path === '/music' || path.startsWith('/music/')
      || path === '/alg/sq1/pbl' || path.startsWith('/alg/sq1/pbl/')
      || path === '/alg/sq1/pbl-finder' || path.startsWith('/alg/sq1/pbl-finder/')
      || path === '/alg/sq1/karnaukh-notation' || path.startsWith('/alg/sq1/karnaukh-notation/')
      || (path.startsWith('/pets') && url.searchParams.get('pet') === 'clawd');
  } catch { return true; }
}

// Kept at its existing URL so deployed Apple WebViews can read the same region policy.
export const INSTALLED_COMMUNITY_POLICY_PATH = '/api/installed-forum';

export async function fetchInstalledCommunityAvailability(
  url: string,
  signal: AbortSignal,
): Promise<boolean | null> {
  try {
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal });
    if (!response.ok) return null;
    const { available } = await response.json();
    return typeof available === 'boolean' ? available : null;
  } catch {
    return null;
  }
}

export function isInstalledCommunityHref(href: string, origin = 'https://cuberoot.me'): boolean {
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin && !['cuberoot.me', 'www.cuberoot.me', 'next.cuberoot.me', 'dev.cuberoot.me'].includes(url.hostname)) return false;
    const path = decodeURIComponent(url.pathname).replace(/^\/(?:en|zh)(?=\/|$)/, '').replace(/\/+$/, '');
    return /^\/(?:forum|feedback|quiz\/(?:new|manage)|calendar\/s|platform\/(?:community|admin\/community)|timer\/watch)(?=\/|$)/.test(path)
      || /^\/recon\/[^/]+\/alt(?:$|\/(?:new|[^/]+\/edit)(?=\/|$))/.test(path)
      || (path === '/timer' && (['share', 'r', 'replay'].some(key => url.searchParams.has(key))
        || url.searchParams.get('players') === 'net' || url.searchParams.has('room')));
  } catch {
    return true;
  }
}
