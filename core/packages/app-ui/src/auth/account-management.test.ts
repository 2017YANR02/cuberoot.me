import { describe, expect, it, vi } from 'vitest';
import { mobileEmbedAccountManageMessage } from '@cuberoot/shared/mobile-embed';
import { ACCOUNT_MANAGEMENT_OPEN_TIMEOUT_MS, openInstalledAccountManagement } from './account-management';

const user = { uid: 42, wcaId: null, name: 'CubeRoot', avatar: '', avatarSource: 'auto' as const, avatarPreset: null, isAdmin: false };
const session = { token: 'long-lived-native-token', user };
const request = mobileEmbedAccountManageMessage(42, 'request-1234');

function setup() {
  return {
    currentSession: vi.fn(() => session),
    openExternal: vi.fn(async (_href: string): Promise<void> => undefined),
  };
}

describe('installed account management Browser handoff', () => {
  it('releases a hung native browser request before the embedded acknowledgement expires', async () => {
    vi.useFakeTimers();
    try {
      const deps = setup();
      let finish!: () => void;
      deps.openExternal.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
      const opening = openInstalledAccountManagement(request, 'https://cuberoot.me/account', deps);
      const assertion = expect(opening).rejects.toThrow('timed out');
      await vi.advanceTimersByTimeAsync(ACCOUNT_MANAGEMENT_OPEN_TIMEOUT_MS);
      await assertion;
      await openInstalledAccountManagement(request, 'https://cuberoot.me/account', deps);
      finish();
      expect(deps.openExternal).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it('does not acknowledge success for an account changed during browser opening', async () => {
    const deps = setup();
    deps.openExternal.mockImplementation(async () => {
      deps.currentSession.mockReturnValue({ ...session, user: { ...user, uid: 7 } });
    });
    await expect(openInstalledAccountManagement(request, 'https://cuberoot.me/account', deps)).rejects.toThrow('account changed');
  });
  it('opens the canonical account page with link intent but never transfers any session or ticket', async () => {
    const deps = setup();
    await openInstalledAccountManagement(request, 'https://cuberoot.me/zh/account', deps);
    const href = deps.openExternal.mock.calls[0][0];
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe('https://cuberoot.me/zh/account');
    expect(url.hash).toBe('');
    expect(Object.fromEntries(url.searchParams)).toEqual({ view: 'signin', link_provider: 'apple', expected_uid: '42' });
    expect(href).not.toContain(session.token);
    expect(href).not.toContain('ticket');
  });

  it('rejects a different iframe account', async () => {
    const deps = setup();
    await expect(openInstalledAccountManagement({ ...request, expectedUid: 7 }, 'https://cuberoot.me/account', deps)).rejects.toThrow('account changed');
    expect(deps.openExternal).not.toHaveBeenCalled();
  });

  it('never opens an untrusted account-management origin', async () => {
    const deps = setup();
    await expect(openInstalledAccountManagement(request, 'https://evil.test/account', deps)).rejects.toThrow('invalid account origin');
    expect(deps.openExternal).not.toHaveBeenCalled();
  });
});
