// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeWcaSession, useAuthStore } from '@/lib/auth-store';

const provisionalUser = {
  wcaId: '2017YANR02',
  name: 'Provisional WCA Name',
  avatar: 'provisional.png',
  country: 'CN',
};

const defaultAvatarSelection = {
  avatarSource: 'auto',
  avatarPreset: null,
  isAdmin: false,
} as const;

function installProvisionalSession() {
  localStorage.setItem('wca_user', JSON.stringify(provisionalUser));
  localStorage.setItem('wca_access_token', 'short-lived-wca-token');
  useAuthStore.getState().refresh();
}

describe('WCA callback canonical session', () => {
  beforeEach(() => {
    localStorage.clear();
    installProvisionalSession();
  });

  it('executes the callback exchange and replaces the provisional profile with the canonical session', async () => {
    const canonicalUser = {
      uid: 66,
      wcaId: '2017YANR02',
      name: '颜瑞民',
      avatar: 'canonical.png',
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      token: 'c'.repeat(20),
      user: canonicalUser,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(exchangeWcaSession('short-lived-wca-token', fetcher)).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/v1/auth/exchange'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: 'short-lived-wca-token' }),
    });
    expect(localStorage.getItem('cuberoot_jwt')).toBe('c'.repeat(20));
    expect(JSON.parse(localStorage.getItem('wca_user') ?? 'null')).toEqual({
      ...canonicalUser,
      country: '',
      ...defaultAvatarSelection,
    });
    expect(useAuthStore.getState().user).toEqual({
      ...canonicalUser,
      country: '',
      ...defaultAvatarSelection,
    });
  });

  it('keeps the provisional WCA fallback when the exchange response is invalid', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      token: 'c'.repeat(20),
      user: { wcaId: '2017YANR02', name: '缺少 uid', avatar: '' },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(exchangeWcaSession('short-lived-wca-token', fetcher)).resolves.toBe(false);

    expect(localStorage.getItem('cuberoot_jwt')).toBeNull();
    expect(JSON.parse(localStorage.getItem('wca_user') ?? 'null')).toEqual(provisionalUser);
    expect(useAuthStore.getState().user).toEqual({
      ...provisionalUser,
      ...defaultAvatarSelection,
    });
  });
});
