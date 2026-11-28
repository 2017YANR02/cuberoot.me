// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useAccountCardAccess } from '@/components/account/useAccountCardAccess';
import type { WcaUser } from '@/lib/auth-store';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  fetch: vi.fn(),
  listContexts: vi.fn(),
}));
vi.mock('@/lib/auth-store', () => ({
  getAuthUser: mocks.getUser,
  hasAdminAccess: (user: WcaUser | null) => user?.isAdmin === true,
  getSessionToken: () => 'session',
  getWcaToken: () => null,
}));
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
vi.mock('@/lib/session-fetch', () => ({ sessionFetch: mocks.fetch }));
vi.mock('@/lib/teaching-saas-api', () => ({ listTeachingLearningContexts: mocks.listContexts }));

it('keeps optional cards scoped to the signed-in account, even after a late response', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.createElement('div'));
  let access: ReturnType<typeof useAccountCardAccess> | undefined;
  function Probe({ user }: { user: WcaUser }) {
    access = useAccountCardAccess(user);
    return null;
  }
  const render = (uid: number, isAdmin = false) => {
    const user = { uid, isAdmin } as WcaUser;
    mocks.getUser.mockReturnValue(user);
    return act(async () => root.render(createElement(Probe, { user })));
  };

  let resolveOldContexts!: (value: unknown[]) => void;
  const oldContexts = new Promise(resolve => { resolveOldContexts = resolve; });
  mocks.listContexts.mockReturnValueOnce(oldContexts).mockResolvedValue([]);
  mocks.fetch.mockImplementation(async (path: string) => {
    const enabled = mocks.getUser().uid === 1;
    return Response.json(path.includes('workspace') ? { status: enabled ? 'enabled' : 'pending' } : { available: enabled });
  });

  try {
    await render(1);
    expect(access).toEqual({ learning: false, vault: true, workspace: true });
    await render(2);
    await act(async () => resolveOldContexts([{}]));
    expect(access).toEqual({ learning: false, vault: false, workspace: false });

    mocks.listContexts.mockResolvedValueOnce([{}]);
    mocks.fetch.mockClear();
    await render(3, true);
    expect(access).toEqual({ learning: true, vault: true, workspace: true });
    expect(mocks.fetch).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
  }
});
