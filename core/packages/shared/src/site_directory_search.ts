export interface SiteSearchCard {
  id: string;
  href: string;
  internal: boolean;
  adminOnly?: boolean;
  lockedForNonAdmin?: boolean;
  nameEn: string;
  nameZh: string;
  sectionTitleEn: string;
  sectionTitleZh: string;
  /** Additional aliases/descriptions from the page's existing catalog. */
  keywords?: string;
}

export function tokenizeSiteSearch(q: string): string[] {
  const withBoundary = q
    .replace(/([^\x00-\x7F])([a-z0-9])/gi, '$1 $2')
    .replace(/([a-z0-9.])([^\x00-\x7F])/gi, '$1 $2');
  return withBoundary.split(/\s+/).map(t => t.trim()).filter(t => t.length > 0);
}
export function allSiteSearchTokensIn(haystack: string, tokens: readonly string[]): boolean {
  for (const t of tokens) if (!haystack.includes(t)) return false;
  return true;
}

export function searchSiteCards(cards: readonly SiteSearchCard[], query: string): SiteSearchCard[] {
  const tokens = tokenizeSiteSearch(query.trim().toLowerCase());
  if (tokens.length === 0) return [];
  return cards.filter(card => allSiteSearchTokensIn(
    `${card.nameEn}\n${card.nameZh}\n${card.sectionTitleEn}\n${card.sectionTitleZh}\n${card.href}\n${card.keywords ?? ''}`.toLowerCase(),
    tokens,
  ));
}
