import { describe, expect, it } from 'vitest';
import { accountNavigationBack as back, accountNavigationHref as href } from '@/lib/account-navigation';

const url = (path: string) => new URL(path, 'https://cuberoot.invalid');
describe('account entry return navigation', () => {
  it('retains locale and account category, excluding credentials and payment state', () => {
    const target = href('/zh/pets?pet=calico', '/zh/account?settings=appearance&view=main&ticket=secret&next=%2Ftimer&order=123');
    expect(back(target)).toBe('/zh/account?settings=appearance&view=main');
    expect(target).not.toMatch(/secret|ticket|next|order/);
    expect(url(target).searchParams.get('pet')).toBe('calico');
  });
  it.each(['/friends', '/pets', '/vault', '/notifications', '/membership', '/learn', '/org', '/alg/progress', '/account/verify', '/account/mcp', '/admin/team', '/dev/team', '/wca/persons/2017TEST01', '/recon/person/2017TEST01'])('covers %s', path => {
    expect(back(href(path, '/account'))).toBe('/account');
  });
  it('returns from nested gallery to pet entry, then account, after reload', () => {
    const entry = href('/pets?pet=calico', '/account?settings=appearance');
    const child = href('/pets/gallery?pet=calico', entry);
    const parent = back(child)!;
    expect(url(parent).pathname).toBe('/pets');
    expect(url(parent).searchParams.get('pet')).toBe('calico');
    expect(back(parent)).toBe('/account?settings=appearance');
  });
  it('does not affect other entry points or spread context into unrelated pages', () => {
    expect(href('/pets', '/')).toBe('/pets');
    expect(back('/pets')).toBeNull();
    expect(href('/timer', href('/pets', '/account'))).toBe('/timer');
    expect(href('/auth/login?next=%2Fpets', '/account')).toBe('/auth/login?next=%2Fpets');
    expect(href('/account?view=signin', '/account')).toBe('/account?view=signin');
  });
  it('keeps workspace provenance through its legacy redirect and tab links', () => {
    const old = href('/zh/dev/team', '/zh/account?settings=account');
    const current = href('/zh/admin/team?section=onboarding', old);
    expect(back(current)).toBe('/zh/account?settings=account');
    expect(back(href('/zh/admin/team?section=projects', current))).toBe('/zh/account?settings=account');
  });
  it('maps embedded account settings back to account', () => {
    expect(back(href('/friends', '/chat?settings=account&conversation=private'))).toBe('/account?settings=account');
    expect(href('/friends', '/chat')).toBe('/friends');
  });
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/timer'])('rejects unsafe or non-account return %s', destination => {
    expect(back('/pets?accountBack=' + encodeURIComponent(destination) + '&accountEntry=%2Fpets')).toBeNull();
  });
  it('ignores forged context outside its entry scope', () => {
    expect(back('/timer?accountBack=%2Faccount&accountEntry=%2Fpets')).toBeNull();
    expect(back('/pets?accountBack=%2Faccount&accountEntry=%2F')).toBeNull();
  });
});
