import { SITE_DIRECTORY_GROUPS, type SiteDirectoryEntry } from '@cuberoot/shared/site-directory';

const entries: readonly SiteDirectoryEntry[] = SITE_DIRECTORY_GROUPS.flatMap((group) => [...group.entries]);
export const PAGE_SESSION_COOKIE = 'cuberoot_page_session';

/** Parent locks include descendants; query-specific cards only match their own target. */
export function matchingHomeCards(url: URL): SiteDirectoryEntry[] {
  const pathname = decodeURIComponent(url.pathname).replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
  return entries.filter((entry) => {
    if (!entry.internal) return false;
    const target = new URL(entry.href, url.origin);
    return (pathname === target.pathname || pathname.startsWith(`${target.pathname}/`))
      && [...target.searchParams].every(([key, value]) => url.searchParams.get(key) === value);
  });
}

export function homeCardsRequireAdmin(cards: readonly SiteDirectoryEntry[], locks: Record<string, boolean>): boolean {
  return cards.some((card) => ('adminOnly' in card && card.adminOnly)
    || (locks[card.id] ?? ('lockedForNonAdmin' in card && card.lockedForNonAdmin) ?? false));
}

/** Existing bearer session for document requests; never trusted without API verification. */
export function syncPageSessionCookie(token: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${PAGE_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${token ? 3600 : 0}${window.location.protocol === 'https:' ? '; Secure' : ''}`;
}
