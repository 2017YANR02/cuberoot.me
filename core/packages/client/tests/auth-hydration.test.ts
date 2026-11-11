// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authActions, getAuthUser, subscribeAuthUser, useAuthStore, useAuthUser, useIsAdmin, type WcaUser,
} from '@/lib/auth-store';

const member: WcaUser = {
  uid: 11, wcaId: '', name: 'Member', country: '', avatar: '',
  avatarSource: 'auto', avatarPreset: null, isAdmin: false,
};
const admin: WcaUser = { ...member, uid: 12, name: 'Admin', isAdmin: true };
const original = useAuthStore.getState();
let host: HTMLDivElement;
let root: Root | undefined;

function Controls() {
  const user = useAuthUser();
  const isAdmin = useIsAdmin();
  return createElement('div', null,
    createElement('span', null, user?.name ?? 'Guest'),
    isAdmin && createElement('button', { type: 'button' }, 'Edit'),
  );
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  host.remove();
  useAuthStore.setState(original, true);
  vi.restoreAllMocks();
});

describe('auth rendering across SSR, hydration and account changes', () => {
  it.each([null, member, admin])('hydrates a saved session without replacing server HTML: %j', async user => {
    // Browser storage has already populated the store before React starts.
    useAuthStore.setState({ user });
    host.innerHTML = renderToString(createElement(Controls));
    expect(host.textContent).toBe('Guest');
    const serverSpan = host.querySelector('span');
    const recoverableErrors: unknown[] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      root = hydrateRoot(host, createElement(Controls), {
        onRecoverableError: error => recoverableErrors.push(error),
      });
    });
    expect(recoverableErrors).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(host.querySelector('span')).toBe(serverSpan);
    expect(host.querySelector('span')?.textContent).toBe(user?.name ?? 'Guest');
    expect(host.querySelector('button') !== null).toBe(user?.isAdmin ?? false);
  });

  it('updates mounted controls on login, account switch, role removal and logout', async () => {
    useAuthStore.setState({ user: null });
    await act(async () => { root = createRoot(host); root.render(createElement(Controls)); });
    for (const user of [member, admin, { ...admin, isAdmin: false }, null]) {
      await act(async () => { useAuthStore.setState({ user }); });
      expect(host.querySelector('span')?.textContent).toBe(user?.name ?? 'Guest');
      expect(host.querySelector('button') !== null).toBe(user?.isAdmin ?? false);
    }
  });

  it('reads the live session on a later client-only mount', async () => {
    useAuthStore.setState({ user: admin });
    const firstRender: Array<WcaUser | null> = [];
    function LaterControls() { firstRender.push(useAuthUser()); return null; }
    await act(async () => { root = createRoot(host); root.render(createElement(LaterControls)); });
    expect(firstRender[0]).toBe(admin);
  });

  it('keeps commands and async identity checks current and supports unsubscribe', () => {
    useAuthStore.setState({ user: member });
    const listener = vi.fn();
    const stop = subscribeAuthUser(listener);
    useAuthStore.setState({ user: admin });
    expect(getAuthUser()).toBe(admin);
    expect(listener).toHaveBeenLastCalledWith(admin, member);
    stop();
    useAuthStore.setState({ user: null });
    expect(getAuthUser()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    const actions = { login: vi.fn(), loginWithWca: vi.fn(), logout: vi.fn(), refresh: vi.fn() };
    useAuthStore.setState(actions);
    authActions.login(); authActions.loginWithWca('/account'); authActions.logout(); authActions.refresh();
    expect(actions.login).toHaveBeenCalledOnce();
    expect(actions.loginWithWca).toHaveBeenCalledWith('/account');
    expect(actions.logout).toHaveBeenCalledOnce();
    expect(actions.refresh).toHaveBeenCalledOnce();
  });
});
