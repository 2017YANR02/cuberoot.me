import { afterEach, describe, expect, it, vi } from 'vitest';
import { membershipEntryHref, membershipReturnPath, rememberMembershipReturn, readMembershipReturn } from '@/lib/membership-return';

afterEach(() => vi.unstubAllGlobals());
describe('membership continuation', () => {
  it('preserves the product query and fragment through the login destination', () => {
    const source = '/zh/sim?puzzle=3&img_dist=6#appearance';
    const membership = membershipEntryHref(source);
    const login = `/zh/account?next=${encodeURIComponent(membership)}`;
    const resumed = new URL(login, 'https://cuberoot.me').searchParams.get('next')!;
    expect(new URL(resumed, 'https://cuberoot.me').searchParams.get('next')).toBe(source);
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/zh/account?next=/sim', '/membership?paid=1'])('rejects unsafe or looping destination %s', path => {
    expect(membershipReturnPath(path)).toBe(null);
  });
  it('retains a provider round trip only for the same account and expires it', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
    rememberMembershipReturn('/sim?puzzle=3', 1);
    expect(readMembershipReturn(1)).toBe('/sim?puzzle=3');
    expect(readMembershipReturn(2)).toBe(null);
    expect(readMembershipReturn(1)).toBe(null);
    rememberMembershipReturn('/sim', 1);
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3 * 60 * 60 * 1000);
    expect(readMembershipReturn(1)).toBe(null);
    now.mockRestore();
  });
});
