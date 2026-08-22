import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
    expect(sections).toMatch(/\{ id: 'teaching', href: '\/courses', internal: true,[^}]+\}/);
    expect(sections.match(/\{ id: 'teaching', href: '\/courses'[^}]+\}/)?.[0]).not.toContain('adminOnly');
    expect(account).toContain("key: 'membership'");
    expect(account).toContain("href: '/membership'");
    expect(account).toContain("key: 'notifications'");
    expect(account).toContain("href: '/notifications'");
    expect(account).toMatch(/<AppLink key=\{key\} href=\{href\} className="account-card" prefetch=\{false\}>/);
  });

  it('uses AppLink and disables prefetch for high-cardinality search results', () => {
    const search = read('components/LandingSearch.tsx');

    expect(search).toContain("import Link from '@/components/AppLink'");
    expect(search).not.toContain("from 'next/link'");
    expect(search).toMatch(/href=\{c\.href\}\s+prefetch=\{false\}/);
    expect(search).toMatch(/href=\{`\/wca\/persons\/\$\{p\.wcaId\}`\}\s+prefetch=\{false\}/);
    expect(search).toContain("aria-label={tr({ zh: '全站搜索', en: 'Site search' })}");
  });
});
