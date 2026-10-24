// @vitest-environment jsdom

import { act, createElement, StrictMode } from 'react';
import { readFileSync } from 'node:fs';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Callback from '@/app/auth/callback/page';
import { AccountChoiceRequired, clearIdentityChoice, getIdentityChoice, rememberIdentityChoice, updateIdentityChoice } from '@/lib/identity-choice';

const mocks = vi.hoisted(() => ({ loginWca: vi.fn(), linkWca: vi.fn(), getSessionToken: vi.fn(), applySession: vi.fn(), replace: vi.fn() }));
vi.mock('@/lib/account-api', () => ({ loginWca: mocks.loginWca, linkWca: mocks.linkWca }));
vi.mock('@/lib/auth-store', () => ({ applySession: mocks.applySession, getRolePreview: () => null, getSessionToken: mocks.getSessionToken }));
vi.mock('@/components/AppLink', () => ({ default: ({ children }: { children: React.ReactNode }) => createElement('a', { href: '/account' }, children) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
let root: Root; let host: HTMLDivElement;

const identityHandle = 'h'.repeat(43);
const secondIdentityHandle = 'i'.repeat(43);
function stubIdentityRequests(fallback = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'))) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === '/api/identity-choice') {
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.operation === 'store') return new Response(JSON.stringify({ handle: body.ticket.startsWith('b') ? secondIdentityHandle : identityHandle }));
      if (body.operation === 'clear') return new Response('{}');
    }
    return fallback(input, init);
  });
}
beforeEach(async () => {
  stubIdentityRequests();
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear(); localStorage.clear(); clearIdentityChoice();
  window.history.replaceState({}, '', '/auth/callback#access_token=wca-assertion&state=csrf');
  sessionStorage.setItem('wca_oauth_state', 'csrf'); sessionStorage.setItem('wca_return_url', '/account?auth=mobile&next=original');
  mocks.applySession.mockReturnValue(true);
  mocks.getSessionToken.mockReturnValue(null);
  mocks.loginWca.mockResolvedValue({ token: 'canonical', user: { uid: 42, wcaId: '2017YANR02' }, isNew: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); clearIdentityChoice(); vi.unstubAllGlobals(); });
const render = async () => { await act(async () => root.render(createElement(StrictMode, null, createElement(Callback)))); };

describe('WCA canonical-only first identity callback', () => {
  it.each([false, true])('preserves the registration binding intent (failure: %s)', async (failure) => {
    sessionStorage.setItem('wca_oauth_intent', 'link');
    mocks.getSessionToken.mockReturnValue('existing-session');
    if (failure) mocks.linkWca.mockRejectedValue(new Error('No WCA ID'));
    else mocks.linkWca.mockResolvedValue({ ok: true });
    await render();
    expect(mocks.linkWca).toHaveBeenCalledExactlyOnceWith('wca-assertion', expect.any(AbortSignal));
    expect(mocks.loginWca).not.toHaveBeenCalled();
    expect(mocks.applySession).not.toHaveBeenCalled();
    if (failure) {
      expect(mocks.replace).not.toHaveBeenCalled();
      expect(host.textContent).toContain('Link failed: No WCA ID');
      expect(host.querySelector('a')?.getAttribute('href')).toBe('/account');
    } else expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/account?auth=mobile&next=original');
  });

  it('leaves no background login iframe after returning to the account page', async () => {
    // Reproduce the document bootstrap before React owns the callback route.
    // Executing the real body scripts catches DOM inserted outside the React root.
    const layout = readFileSync('app/layout.tsx', 'utf8');
    const body = layout.slice(layout.indexOf('<body'), layout.indexOf('</body>'));
    expect(body).toContain('<AppNuqsAdapter>');
    sessionStorage.setItem('wca_return_url', '/zh/account');
    for (const match of body.matchAll(/__html:\s*`([^`]*)`/g)) window.eval(match[1]);

    let complete!: (value: unknown) => void;
    mocks.loginWca.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    try {
      await render();
      expect(host.querySelector('[role="status"]')?.textContent).toContain('Signing in to WCA');
      await act(async () => complete({ token: 'canonical', user: { uid: 42, wcaId: '2017YANR02' } }));
      expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/zh/account');
      await act(async () => root.render(createElement('main', { 'data-account': true }, 'My account')));
      expect(host.querySelector('[data-account]')?.textContent).toBe('My account');
      expect(host.querySelector('.auth-callback-status')).toBeNull();
      expect(document.body.querySelectorAll('iframe')).toHaveLength(0);
    } finally {
      document.body.querySelectorAll('iframe').forEach(frame => frame.remove());
    }
  });

  it('preserves Chinese from the initiating page after a new WCA identity', async () => {
    sessionStorage.setItem('wca_return_url', '/zh/account?next=%2Fzh%2Frecon');
    mocks.loginWca.mockRejectedValue(new AccountChoiceRequired({ ticket: 'a'.repeat(43), provider: 'wca', expiresInSeconds: 900 }));
    await render(); expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/zh/account');
  });
  it('exchanges once before applying the canonical session and returns safely', async () => {
    await render();
    expect(mocks.loginWca).toHaveBeenCalledExactlyOnceWith('wca-assertion', expect.any(AbortSignal));
    expect(mocks.applySession).toHaveBeenCalledExactlyOnceWith('canonical', { uid: 42, wcaId: '2017YANR02' }, expect.any(Function));
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
    await rememberIdentityChoice(new AccountChoiceRequired({ ticket: 'a'.repeat(43), provider: 'apple', expiresInSeconds: 900 }), '/original');
    updateIdentityChoice(identityHandle, { stage: 'authenticate' });
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
