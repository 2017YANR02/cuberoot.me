// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { getMyMembership } from '@/lib/membership-api';

const auth = vi.hoisted(() => ({ token: 'owner-a', user: { uid: 1, wcaId: '' } as { uid: number; wcaId: string } | null }));
const read = vi.hoisted(() => vi.fn<typeof getMyMembership>());
vi.mock('@/lib/auth-store', () => ({
  useAuthUser: () => auth.user,
  getSessionToken: () => auth.token,
  getWcaToken: () => '',
}));
vi.mock('@/lib/membership-api', () => ({ getMyMembership: read }));
import { useMembership } from '@/hooks/useMembership';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
type Result = Awaited<ReturnType<typeof getMyMembership>>;

describe('membership request ownership', () => {
  let root: Root;
  let host: HTMLDivElement;
  let current: ReturnType<typeof useMembership>;
  function Probe() { current = useMembership(); return null; }
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    auth.token = 'owner-a';
    auth.user = { uid: 1, wcaId: '' };
    read.mockReset();
    host = document.createElement('div');
    root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); });

  it('does not restore member access when a pre-logout response arrives late', async () => {
    const old = deferred<Result>();
    read.mockReturnValueOnce(old.promise);
    await act(async () => root.render(createElement(Probe)));
    auth.user = null;
    auth.token = '';
    await act(async () => root.render(createElement(Probe)));
    await act(async () => old.resolve({ membership: null, isMember: true }));
    expect(current!.isMember).toBe(false);
    expect(current!.loading).toBe(false);
  });

  it('refreshes between two accounts without WCA IDs and ignores the old account response', async () => {
    const first = deferred<Result>();
    const second = deferred<Result>();
    read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await act(async () => root.render(createElement(Probe)));
    auth.user = { uid: 2, wcaId: '' };
    auth.token = 'owner-b';
    await act(async () => root.render(createElement(Probe)));
    expect(read).toHaveBeenCalledTimes(2);
    await act(async () => second.resolve({ membership: null, isMember: false }));
    await act(async () => first.resolve({ membership: null, isMember: true }));
    expect(current!.isMember).toBe(false);
  });

  it('keeps the latest refresh result when an older refresh fails afterwards', async () => {
    const first = deferred<Result>();
    const second = deferred<Result>();
    read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await act(async () => root.render(createElement(Probe)));
    await act(async () => current!.refresh());
    await act(async () => second.resolve({ membership: null, isMember: true }));
    await act(async () => first.reject(new Error('old request failed')));
    expect(current!.isMember).toBe(true);
    expect(current!.loading).toBe(false);
  });

  it('does not let an older completion clear a newer refresh loading state', async () => {
    const first = deferred<Result>();
    const second = deferred<Result>();
    read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await act(async () => root.render(createElement(Probe)));
    await act(async () => current!.refresh());
    await act(async () => first.resolve({ membership: null, isMember: true }));
    expect(current!.loading).toBe(true);
    expect(current!.isMember).toBe(false);
    await act(async () => second.resolve({ membership: null, isMember: false }));
  });
});
