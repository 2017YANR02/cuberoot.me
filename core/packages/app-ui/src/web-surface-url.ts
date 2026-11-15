import type { SupportedLanguage } from './copy';

/**
 * Enter the existing website locale tree explicitly inside an embedded surface.
 * A bare English URL negotiates against cookies/Accept-Language; cross-site
 * WebViews cannot rely on accepting the website's SameSite=Lax language cookie.
 * This only chooses the initial product-page entry, never rewrites navigation
 * reported by the website (which can also point into non-localized tool assets).
 * Public/share URLs keep the website's canonical bare-English shape.
 */
export function installedWebEntryUrl(href: string, language: SupportedLanguage): string {
  const url = new URL(href);
  const rest = url.pathname.replace(/^\/(en|zh)(?=\/|$)/, '');
  url.pathname = `/${language}${rest === '/' ? '' : rest}`;
  url.searchParams.delete('lang');
  return url.href;
}
