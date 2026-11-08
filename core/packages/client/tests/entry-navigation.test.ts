// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  currentEntryHref, entryNavigationBack, entryNavigationHref, installEntryNavigation,
} from '@/lib/entry-navigation';

const nativeReplace = window.history.replaceState.bind(window.history);
let dispose: () => void;
const current = () => window.location.pathname + window.location.search + window.location.hash;
const back = () => entryNavigationBack(current());
function visit(path: string) {
  dispose?.();
  sessionStorage.clear();
  nativeReplace({ __NA: true, tree: 'next-router' }, '', path);
  dispose = installEntryNavigation();
}
function go(path: string, mode: 'push' | 'replace' | 'return' | 'none' = 'push') {
  const href = currentEntryHref(path, mode);
  window.history[mode === 'replace' ? 'replaceState' : 'pushState']({ __NA: true, tree: 'next-router' }, '', href);
  expect(current()).toBe(href);
  expect(href).not.toMatch(/navBack|accountBack|shopBack/);
  return href;
}
async function traverse(delta: number) {
  const restored = new Promise<void>(resolve => window.addEventListener('popstate', () => resolve(), { once: true }));
  window.history.go(delta);
  await restored;
}
beforeEach(() => visit('/'));
afterEach(() => { dispose(); vi.restoreAllMocks(); });

describe('local entry navigation', () => {
  it.each([
    ['/platform/orders', '/shop'],
    ['/zh/platform/account/shipping', '/zh/shop?q=mat'],
    ['/wca/persons/2017TEST01', '/wca/results?tab=records'],
    ['/timer', '/alg/3x3/oll'],
    ['/teachers?teacher=42', '/platform/courses'],
    ['/membership', '/account?settings=account'],
    ['/recon/123', '/recon?q=OLL&page=3'],
    ['/docs/edit?id=123', '/docs'],
  ])('returns %s to %s without putting provenance in the link', (target, source) => {
    visit(source);
    expect(entryNavigationHref(target, source)).toBe(target);
    go(target);
    expect(back()).toBe(source);
    expect(window.history.state.tree).toBe('next-router');
  });
  it('unwinds a multi-module journey across reloads', () => {
    visit('/zh/shop?q=mat');
    go('/zh/platform/orders'); go('/zh/platform/orders/123'); go('/zh/contact');
    dispose(); dispose = installEntryNavigation();
    expect(back()).toBe('/zh/platform/orders/123');
    go(back()!, 'return'); expect(back()).toBe('/zh/platform/orders');
    go(back()!, 'return'); expect(back()).toBe('/zh/shop?q=mat');
    go(back()!, 'return'); expect(back()).toBeNull();
  });
  it('keeps separate histories for repeated visits to the same destination', async () => {
    visit('/shop'); go('/contact'); go('/'); go('/wca'); go('/contact');
    expect(back()).toBe('/wca');
    await traverse(-3); expect(current()).toBe('/contact'); expect(back()).toBe('/shop');
    await traverse(3); expect(current()).toBe('/contact'); expect(back()).toBe('/wca');
  });
  it('does not leak local history into a shared or independently opened URL', () => {
    visit('/shop'); const shared = go('/contact');
    expect(shared).toBe('/contact');
    visit(shared); expect(back()).toBeNull();
  });
  it('distinguishes document identities but preserves filters, anchors and replacements', () => {
    visit('/docs'); go('/docs/edit?id=1'); go('/docs/edit?id=2');
    expect(back()).toBe('/docs/edit?id=1');
    window.history.replaceState({ nuqs: 'preserved' }, '', '/docs/edit?id=2&tab=comments#top');
    expect(back()).toBe('/docs/edit?id=1'); expect(window.history.state.nuqs).toBe('preserved');
    go('/zh/docs/edit?id=2&tab=comments', 'replace'); expect(back()).toBe('/docs/edit?id=1');
  });
  it('collapses ancestor links and clears explicit home/opt-out journeys', () => {
    visit('/a'); go('/b'); go('/c'); go('/b'); expect(back()).toBe('/a');
    go('/'); expect(back()).toBeNull();
    go('/contact', 'none'); expect(back()).toBeNull();
  });
  it('hands off full-page navigation once without URL metadata', () => {
    visit('/shop?q=mat');
    const href = currentEntryHref('/contact');
    dispose(); nativeReplace(null, '', href); dispose = installEntryNavigation();
    expect(back()).toBe('/shop?q=mat');
    dispose(); nativeReplace(null, '', href); dispose = installEntryNavigation();
    expect(back()).toBeNull();
  });
  it('does not reuse an expired handoff from a cancelled navigation', () => {
    visit('/shop'); currentEntryHref('/contact');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);
    dispose(); nativeReplace(null, '', '/contact'); dispose = installEntryNavigation();
    expect(back()).toBeNull();
  });
  it('keeps the login next URL intact and resumes after an external auth round trip', () => {
    visit('/recon?page=3'); go('/recon/123');
    const login = go('/account?next=%2Frecon%2F123');
    expect(new URL(login, window.location.origin).searchParams.get('next')).toBe('/recon/123');
    expect(back()).toBe('/recon/123');
    dispose(); nativeReplace(null, '', '/auth/callback'); dispose = installEntryNavigation();
    window.history.replaceState({ __NA: true }, '', currentEntryHref('/recon/123', 'replace'));
    expect(back()).toBe('/recon?page=3');
  });
  it('keeps nested membership continuations outside the URL', () => {
    visit('/alg'); go('/timer');
    go('/account?next=%2Fmembership%3Fnext%3D%252Ftimer');
    go('/membership?next=%2Ftimer', 'replace');
    expect(back()).toBe('/timer');
    go('/timer', 'replace'); expect(back()).toBe('/alg');
  });
  it('excludes credentials and private share paths from local provenance', () => {
    visit('/shop?q=mat&ticket=secret&token=secret&next=%2Faccount&order=123'); go('/contact');
    expect(back()).toBe('/shop?q=mat');
    expect(JSON.stringify(window.history.state)).not.toMatch(/secret|ticket|token|order/);
    visit('/calendar/s/private-token'); go('/contact'); expect(back()).toBeNull();
  });
  it('bounds the trail while URLs remain constant length', () => {
    visit('/page0');
    for (let i = 1; i <= 100; i++) go('/page' + i);
    const trail: string[] = [];
    while (back()) { trail.push(back()!); go(back()!, 'return'); }
    expect(trail).toEqual(Array.from({ length: 8 }, (_, i) => '/page' + (99 - i)));
  });
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/api/test', '/auth/login', '/icons/logo.svg', '#section', 'mailto:a@example.com'])('leaves non-product target %s alone', target => {
    expect(entryNavigationHref(target, '/shop')).toBe(target);
  });
  it.each(['not-json', '["https://evil.test"]', '["//evil.test"]', '["/auth/login"]', '[12]', '{}', JSON.stringify(Array(9).fill('/shop'))])('discards and removes malformed legacy trail %s', value => {
    visit('/contact?navBack=' + encodeURIComponent(value));
    expect(back()).toBeNull(); expect(current()).toBe('/contact');
  });
  it.each([
    ['/contact?navBack=%5B%22%2Fshop%22%5D', '/contact', '/shop'],
    ['/pets?accountBack=%2Faccount%3Fsettings%3Dappearance&accountEntry=%2Fpets', '/pets', '/account?settings=appearance'],
    ['/platform/orders?shopBack=%2Fshop&shopEntry=%2Fplatform%2Forders', '/platform/orders', '/shop'],
  ])('migrates legacy %s into history without losing router state', (legacy, clean, expected) => {
    visit(legacy); expect(current()).toBe(clean); expect(back()).toBe(expected);
    expect(window.history.state.tree).toBe('next-router');
  });
  it('preserves target business payloads and encoding', () => {
    visit('/alg/3x3');
    const target = '/sim?alg=R%20U%20R%27&token=required';
    expect(go(target)).toBe(target); expect(back()).toBe('/alg/3x3');
  });
  it('cleans provenance inside old login continuations without dropping product state', () => {
    const old = '/account?next=' + encodeURIComponent('/recon/123?tab=solution&navBack=' + encodeURIComponent('["/recon"]'));
    visit(old);
    expect(new URL(window.location.href).searchParams.get('next')).toBe('/recon/123?tab=solution');
    expect(current()).not.toContain('navBack');
  });
  it('supports client navigation when sessionStorage is disabled', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    go('/shop'); go('/contact'); expect(back()).toBe('/shop');
  });
});
