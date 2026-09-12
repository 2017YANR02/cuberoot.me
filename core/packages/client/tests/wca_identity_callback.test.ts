// @vitest-environment jsdom

import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Callback from '@/app/auth/callback/page';
import { AccountChoiceRequired, clearIdentityChoice, getIdentityChoice, rememberIdentityChoice, updateIdentityChoice } from '@/lib/identity-choice';

const mocks = vi.hoisted(() => ({ loginWca: vi.fn(), applySession: vi.fn(), replace: vi.fn() }));
vi.mock('@/lib/account-api', () => ({ loginWca: mocks.loginWca }));
vi.mock('@/lib/auth-store', () => ({ applySession: mocks.applySession, getRolePreview: () => null, getSessionToken: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
let root: Root; let host: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear(); localStorage.clear(); clearIdentityChoice();
  window.history.replaceState({}, '', '/auth/callback#access_token=wca-assertion&state=csrf');
  sessionStorage.setItem('wca_oauth_state', 'csrf'); sessionStorage.setItem('wca_return_url', '/account?auth=mobile&next=original');
  mocks.applySession.mockReturnValue(true);
  mocks.loginWca.mockResolvedValue({ token: 'canonical', user: { uid: 42, wcaId: '2017YANR02' }, isNew: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); clearIdentityChoice(); vi.unstubAllGlobals(); });
const render = async () => { await act(async () => root.render(createElement(StrictMode, null, createElement(Callback)))); };

describe('WCA canonical-only first identity callback', () => {
  it('preserves Chinese from the initiating page after a new WCA identity', async () => {
    sessionStorage.setItem('wca_return_url', '/zh/account?next=%2Fzh%2Frecon');
    mocks.loginWca.mockRejectedValue(new AccountChoiceRequired({ ticket: 'a'.repeat(43), provider: 'wca', expiresInSeconds: 900 }));
    await render(); expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/zh/account');
  });
  it('exchanges once before applying the canonical session and returns safely', async () => {
    await render();
    expect(mocks.loginWca).toHaveBeenCalledExactlyOnceWith('wca-assertion', expect.any(AbortSignal));
    expect(mocks.applySession).toHaveBeenCalledExactlyOnceWith('canonical', { uid: 42, wcaId: '2017YANR02' });
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/account?auth=mobile&next=original');
    expect(localStorage.getItem('wca_access_token')).toBeNull();
  });
  it('does not persist a WCA token or provisional profile on unknown identity', async () => {
    mocks.loginWca.mockRejectedValue(new AccountChoiceRequired({ ticket: 'a'.repeat(43), provider: 'wca', expiresInSeconds: 900 }));
    await render();
    expect(mocks.applySession).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0);
    expect(getIdentityChoice()).toMatchObject({ provider: 'wca', stage: 'choose', returnPath: '/account?auth=mobile&next=original' });
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/account');
  });
  it('does not fall back to raw WCA authentication on exchange failure', async () => {
    mocks.loginWca.mockRejectedValue(new Error('backend unavailable'));
    await render();
    expect(mocks.applySession).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0);
    expect(mocks.replace).not.toHaveBeenCalled(); expect(host.textContent).toContain('Login failed');
  });
  it('authenticates an existing account but leaves identity linking for explicit confirmation', async () => {
    rememberIdentityChoice(new AccountChoiceRequired({ ticket: 'a'.repeat(43), provider: 'apple', expiresInSeconds: 900 }), '/original');
    updateIdentityChoice('a'.repeat(43), { stage: 'authenticate' });
    await render();
    expect(getIdentityChoice()).toMatchObject({ provider: 'apple', expectedUid: 42, stage: 'confirm', returnPath: '/original' });
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/account');
  });
  it('rejects a mismatched state before sending the WCA token', async () => {
    sessionStorage.setItem('wca_oauth_state', 'different'); await render();
    expect(mocks.loginWca).not.toHaveBeenCalled(); expect(mocks.applySession).not.toHaveBeenCalled();
  });
  it('ignores a late response after leaving the callback', async () => {
    let resolve!: (value: unknown) => void;
    mocks.loginWca.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await render(); const signal = mocks.loginWca.mock.calls[0][1] as AbortSignal;
    await act(async () => root.render(null)); expect(signal.aborted).toBe(true);
    await act(async () => resolve({ token: 'late', user: { uid: 42 } }));
    expect(mocks.applySession).not.toHaveBeenCalled(); expect(mocks.replace).not.toHaveBeenCalled();
  });
});
