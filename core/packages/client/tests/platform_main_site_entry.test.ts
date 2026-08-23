import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLATFORM_ROUTES } from '@/lib/platform-routes';
import { PLATFORM_SITEMAP_PATHS } from '@/app/sitemap';

const read = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

describe('Platform capabilities stay in canonical main-site entrypoints', () => {
  it('keeps /search as a URL-backed reuse of LandingSearch', () => {
    const page = read('app/[lang]/search/page.tsx');
    const layout = read('app/[lang]/search/layout.tsx');
    const sitemap = read('app/sitemap.ts');

    expect(page).toContain("useQueryState('q'");
    expect(page).toContain('onQueryChange={(value) => { void setQuery(value || null); }}');
    expect(page).toContain('persistentResults');
    expect(page).toContain('<LandingSearch');
    expect(layout).toContain("pageMetadata('search')");
    expect(layout).toContain('robots: { index: false, follow: true }');
    expect(sitemap).toMatch(/EXCLUDE = new Set\(\[[^\]]*'search'/s);
  });

  it('keeps homepage and account links as real AppLink entrypoints', () => {
    const landing = read('app/[lang]/LandingClient.tsx');
    const sections = read('lib/landing-sections.tsx');
    const account = read('app/[lang]/account/page.tsx');

    expect(landing).toMatch(/<Link\s+href="\/search"[\s\S]*?prefetch=\{false\}/);
    expect(sections).toMatch(/\{ id: 'platform', href: '\/platform', internal: true,[^}]+\}/);
    expect(sections.match(/\{ id: 'platform', href: '\/platform'[^}]+\}/)?.[0]).not.toContain('adminOnly');
    expect(sections).toMatch(/\{ id: 'teaching', href: '\/courses', internal: true,[^}]+\}/);
    expect(sections.match(/\{ id: 'teaching', href: '\/courses'[^}]+\}/)?.[0]).not.toContain('adminOnly');
    expect(account).toContain("key: 'membership'");
    expect(account).toContain("href: '/membership'");
    expect(account).toContain("key: 'notifications'");
    expect(account).toContain("href: '/notifications'");
    expect(account).toMatch(/<AppLink key=\{key\} href=\{href\} className="account-card" prefetch=\{false\}>/);
  });

  it('keeps Platform navigation public while the homepage is driven by real role data', () => {
    const shell = read('components/platform/PlatformShell.tsx');
    const routeView = read('components/platform/PlatformRouteView.tsx');
    const styles = read('components/platform/platform.css');
    const homeStart = routeView.indexOf('function PlatformLanding');
    const homeEnd = routeView.indexOf('\nfunction PlatformAboutView', homeStart);

    expect(shell).toContain('PLATFORM_PUBLIC_NAV');
    expect(shell).not.toMatch(/\bPLATFORM_NAV\b/);
    expect(routeView).not.toContain('platform-track');
    expect(routeView).not.toContain('platform-directory');
    expect(styles).not.toMatch(/\.platform-(track|directory|landing-links)\b/);
    expect(styles).toMatch(/\.platform-nav\s*\{[^}]*grid-template-columns:\s*repeat\(5,/s);
    expect(styles).toMatch(/\.platform-account-link\s*\{[^}]*min-height:\s*44px/s);
    expect(homeStart).toBeGreaterThanOrEqual(0);
    expect(homeEnd).toBeGreaterThan(homeStart);

    const home = routeView.slice(homeStart, homeEnd);
    expect(home).toContain('useAuthUser()');
    expect(home).toContain('useIsAdmin()');
    expect(home).toMatch(/loadPlatformResource\(\s*'account-courses'/);
    expect(home).toMatch(/loadPlatformResource\(\s*'account-progress'/);
    expect(home).toMatch(/loadPlatformResource\(\s*'instructor-courses'/);
    expect(home).toMatch(/listTeachingOrganizations\(/);
    expect(home).not.toMatch(/\bPLATFORM_ROUTES\b|\bexecutePlatformAction\b|<PlatformDomainActions\b/);
    expect(routeView).toContain('const permissionDenied = error instanceof PlatformPermissionError;');
    expect(routeView).toMatch(/!permissionDenied \? <PlatformDomainContent/);
    expect(routeView).toMatch(/permissionDenied \|\| \(\['membership', 'me-membership'\]/);
  });

  it('uses AppLink and disables prefetch for high-cardinality search results', () => {
    const search = read('components/LandingSearch.tsx');

    expect(search).toContain("import Link from '@/components/AppLink'");
    expect(search).not.toContain("from 'next/link'");
    expect(search).toMatch(/href=\{c\.href\}\s+prefetch=\{false\}/);
    expect(search).toMatch(/href=\{`\/wca\/persons\/\$\{p\.wcaId\}`\}\s+prefetch=\{false\}/);
    expect(search).toContain("aria-label={tr({ zh: '全站搜索', en: 'Site search' })}");
  });

  it('gives public Platform subroutes distinct metadata and sitemap coverage', () => {
    const layout = read('app/[lang]/platform/layout.tsx');
    const page = read('app/[lang]/platform/[...segments]/page.tsx');
    const expected = PLATFORM_ROUTES
      .filter((route) => route.access === 'public'
        && route.pattern !== ''
        && !route.pattern.includes(':')
        && !route.canonicalHref
        && !['search', 'offline', 'login', 'notifications'].includes(route.id))
      .map((route) => `platform/${route.pattern}`)
      .sort();

    expect(layout).toContain("pageMetadata('platform')");
    expect(layout).toContain("canonical: lang === 'zh' ? zh : en");
    expect(layout).toContain("languages: { en, zh, 'x-default': en }");
    expect(page).toContain('metadataFromEntry');
    expect(page).toContain('match.definition.title');
    expect(page).toContain('match.definition.description');
    expect(page).toContain('fillPlatformParams(match.definition.canonicalHref, match.params)');
    expect(PLATFORM_SITEMAP_PATHS.slice().sort()).toEqual(expected);
  });
});
