import { describe, expect, it } from 'vitest';
import { entryNavigationBack as back, entryNavigationHref as href, ENTRY_NAVIGATION_KEY } from '@/lib/entry-navigation';

const url = (path: string) => new URL(path, 'https://cuberoot.invalid');
const clean = (path: string) => { const value = url(path); value.searchParams.delete(ENTRY_NAVIGATION_KEY); return value.pathname + value.search + value.hash; };

describe('shared entry navigation', () => {
  it.each(['/platform/orders', '/platform/account/shipping', '/platform/account/wishlist', '/platform/admin/products', '/account', '/contact', '/privacy'])('returns from shop entry %s to shop', target => {
    expect(back(href(target, '/shop'))).toBe('/shop');
    expect(back(href('/zh' + target, '/zh/shop'))).toBe('/zh/shop');
  });
  it.each([
    ['/wca/persons/2017TEST01', '/wca/results?tab=records'],
    ['/timer', '/alg/3x3/oll'],
    ['/teachers?teacher=42', '/platform/courses'],
    ['/membership', '/account?settings=account'],
    ['/contact', '/shop'],
    ['/recon/123', '/recon?q=OLL&page=3'],
    ['/docs/edit?id=123', '/docs'],
    ['/dev/algorithms', '/search?q=solver'],
  ])('returns %s to its actual entry %s', (target, source) => {
    expect(back(href(target, source))).toBe(source);
  });
  it('unwinds a multi-module journey after reload without adding reverse links', () => {
    const orders = href('/zh/platform/orders', '/zh/shop?q=mat');
    const detail = href('/zh/platform/orders/123', orders);
    const contact = href('/zh/contact', detail);
    const detailBack = back(contact)!;
    expect(clean(detailBack)).toBe('/zh/platform/orders/123');
    expect(back(detailBack)).toBe(orders);
    expect(back(orders)).toBe('/zh/shop?q=mat');
    expect(href(detailBack, contact, 'return')).toBe(detailBack);
  });
  it('keeps direct entry fallbacks unchanged', () => {
    expect(back('/platform/orders', '/platform')).toBeNull();
    expect(href('/platform', '/platform/orders', 'back')).toBe('/platform');
    expect(href('/platform/orders', '/platform/orders/123', 'return')).toBe('/platform/orders');
  });
  it('distinguishes document identities on a shared editor route', () => {
    const first = href('/docs/edit?id=1', '/docs');
    const second = href('/docs/edit?id=2', first);
    expect(back(second)).toBe(first);
    expect(back(href('/docs/edit?id=2&tab=comments', second))).toBe(first);
  });
  it('retains provenance through filters, anchors, replacements and locale changes', () => {
    const entry = href('/zh/wca/results?tab=records', '/zh/wca');
    expect(back(href('/zh/wca/results?tab=rankings', entry))).toBe('/zh/wca');
    expect(back(href('/zh/wca/results#333', entry))).toBe('/zh/wca');
    expect(back(href('/wca/results?tab=records', entry, 'replace'))).toBe('/zh/wca');
    const legacy = href('/zh/dev/team', '/zh/account?settings=account');
    expect(back(href('/zh/admin/team?section=projects', legacy, 'replace'))).toBe('/zh/account?settings=account');
  });
  it('collapses ancestor links instead of creating A-B-A loops', () => {
    const b = href('/b', '/a');
    const c = href('/c', b);
    expect(href('/a', c)).toBe('/a');
    expect(href('/b', c)).toBe(b);
  });
  it('uses explicit Home links to leave the journey', () => {
    expect(href('/zh', href('/zh/contact', '/zh/shop'))).toBe('/zh');
    expect(href('/', '/shop', 'none')).toBe('/');
  });
  it('retains login destinations and resumes without a login loop', () => {
    const detail = href('/recon/123', '/recon?page=3');
    const login = href('/account?next=%2Frecon%2F123', detail);
    const next = url(login).searchParams.get('next')!;
    expect(back(login)).toBe(detail);
    expect(next).toBe(detail);
    expect(href(next, login, 'replace')).toBe(detail);
  });
  it('keeps membership destinations that differ from the entry', () => {
    const login = href('/account?next=%2Fmembership%3Fnext%3D%252Ftimer', '/timer');
    const membership = href(url(login).searchParams.get('next')!, login, 'replace');
    expect(back(membership)).toBe('/timer');
    expect(url(membership).searchParams.get('next')).toBe('/timer');
  });
  it('excludes auth, payment and private payloads from snapshots', () => {
    const target = href('/contact', '/shop?q=mat&ticket=secret&token=secret&next=%2Faccount&order=123&state=secret');
    expect(back(target)).toBe('/shop?q=mat');
    expect(target).not.toMatch(/secret|ticket|token|order/);
    expect(back(href('/contact', '/calendar/s/private-token'))).toBeNull();
  });
  it('bounds history without nested URL growth', () => {
    let current = '/page0';
    for (let i = 1; i <= 100; i++) current = href('/page' + i, current);
    const trail = JSON.parse(url(current).searchParams.get(ENTRY_NAVIGATION_KEY)!);
    expect(trail).toHaveLength(8);
    expect(trail).toEqual(Array.from({ length: 8 }, (_, i) => '/page' + (92 + i)));
    expect(current.length).toBeLessThan(500);
  });
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/api/test', '/auth/login', '/icons/logo.svg', '#section', 'mailto:a@example.com'])('does not rewrite non-product target %s', target => {
    expect(href(target, '/shop')).toBe(target);
  });
  it.each(['not-json', '["https://evil.test"]', '["//evil.test"]', '["/auth/login"]', '[12]', '{}', JSON.stringify(Array(9).fill('/shop'))])('rejects malformed trail %s', value => {
    expect(back('/contact?navBack=' + encodeURIComponent(value))).toBeNull();
  });
  it('reads pre-existing account and shop links', () => {
    expect(back('/pets?accountBack=%2Faccount%3Fsettings%3Dappearance&accountEntry=%2Fpets')).toBe('/account?settings=appearance');
    expect(back('/platform/orders?shopBack=%2Fshop&shopEntry=%2Fplatform%2Forders')).toBe('/shop');
    expect(back('/timer?shopBack=%2Fshop&shopEntry=%2Fplatform%2Forders')).toBeNull();
  });
  it('preserves target payloads rather than sanitizing product operations', () => {
    const target = href('/sim?alg=R%20U%20R%27&token=required', '/alg/3x3');
    expect(url(target).searchParams.get('alg')).toBe("R U R'");
    expect(url(target).searchParams.get('token')).toBe('required');
  });
});
