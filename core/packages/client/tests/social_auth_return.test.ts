import { describe, expect, it } from 'vitest';

import {
  rememberSocialReturnUrl,
  SOCIAL_RETURN_KEY,
  takeSocialReturnUrl,
} from '@/lib/social-auth';

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('social OAuth return handoff', () => {
  it('keeps the return URL in both browser storage scopes', () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    rememberSocialReturnUrl('/account?auth=mobile', session, local);
    expect(session.getItem(SOCIAL_RETURN_KEY)).toBe('/account?auth=mobile');
    expect(local.getItem(SOCIAL_RETURN_KEY)).toBe('/account?auth=mobile');
  });

  it('falls back to localStorage and consumes both copies once', () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    local.setItem(SOCIAL_RETURN_KEY, '/account?auth=mobile&provider=wechat');
    expect(takeSocialReturnUrl(session, local)).toBe('/account?auth=mobile&provider=wechat');
    expect(session.getItem(SOCIAL_RETURN_KEY)).toBeNull();
    expect(local.getItem(SOCIAL_RETURN_KEY)).toBeNull();
    expect(takeSocialReturnUrl(session, local)).toBeNull();
  });
});
