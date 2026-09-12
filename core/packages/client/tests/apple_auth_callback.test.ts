// @vitest-environment jsdom

import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loginSocial: vi.fn(), linkSocial: vi.fn(), applySession: vi.fn(), markWcaLinkPrompt: vi.fn(),
  getSessionToken: vi.fn(), replace: vi.fn(),
}));
vi.mock('@/lib/account-api', () => ({ ...mocks, REDIRECT_AUTH_PROVIDERS: ['apple', 'wechat', 'qq', 'alipay'] }));
vi.mock('@/lib/auth-store', () => mocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en, useLang: () => 'en' }));

let root: Root;
let host: HTMLDivElement;
const loginState = 'nonce.apple.login.9999999999.signature';
const linkState = 'nonce.apple.link.9999999999.signature';
const codeVerifier = 'v'.repeat(43);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear();
  localStorage.clear();
  mocks.getSessionToken.mockReturnValue(null);
  mocks.loginSocial.mockResolvedValue({ token: 'session-in-body-only', user: { uid: 1, wcaId: null }, isNew: true });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function callback(state: string, storedState?: string, extra = '') {
  window.history.replaceState({}, '', `/auth/social/callback?code=short-code&state=${state}${extra}`);
  if (storedState) sessionStorage.setItem('apple_oauth_state', JSON.stringify({ state: storedState, codeVerifier }));
  const { default: Callback } = await import('@/app/auth/social/callback/page');
  await act(async () => root.render(createElement(Callback)));
}

describe('Apple uses the canonical callback and session', () => {
  it('exchanges once and returns to the original mobile handoff', async () => {
    sessionStorage.setItem('social_oauth_return', '/account?auth=mobile&provider=apple');
    await callback(loginState, loginState);
    expect(mocks.loginSocial).toHaveBeenCalledExactlyOnceWith('apple', 'short-code', loginState, codeVerifier, expect.any(AbortSignal));
    expect(mocks.applySession).toHaveBeenCalledExactlyOnceWith('session-in-body-only', { uid: 1, wcaId: null });
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/account?auth=mobile&provider=apple');
    expect(mocks.markWcaLinkPrompt).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem('apple_oauth_state')).toBeNull();
  });

  it.each([undefined, 'wrong-state'])('rejects an unsolicited or mismatched callback (%s) before exchange', async (storedState) => {
    await callback(loginState, storedState);
    expect(mocks.loginSocial).not.toHaveBeenCalled();
    expect(mocks.applySession).not.toHaveBeenCalled();
    expect(host.textContent).toContain('State mismatch');
  });

  it('does not exchange a canceled authorization', async () => {
    await callback(loginState, loginState, '&error=access_denied');
    expect(mocks.loginSocial).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Authorization canceled or denied');
    expect(sessionStorage.getItem('apple_oauth_state')).toBeNull();
  });

  it('requires the existing signed-in session before linking', async () => {
    await callback(linkState, linkState);
    expect(mocks.linkSocial).not.toHaveBeenCalled();
    expect(mocks.loginSocial).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Sign in before linking');
  });

  it('links without replacing the current account session', async () => {
    mocks.getSessionToken.mockReturnValue('current-user-session');
    await callback(linkState, linkState);
    expect(mocks.linkSocial).toHaveBeenCalledExactlyOnceWith('apple', 'short-code', linkState, codeVerifier, expect.any(AbortSignal));
    expect(mocks.loginSocial).not.toHaveBeenCalled();
    expect(mocks.applySession).not.toHaveBeenCalled();
  });

  it('offers a fresh retry at the initiating account screen without replaying a code', async () => {
    sessionStorage.setItem('social_oauth_return', '/zh/account?view=signin&link_provider=apple&expected_uid=42');
    await callback(linkState, linkState, '&error=access_denied');
    expect(host.querySelector<HTMLAnchorElement>('a')?.getAttribute('href'))
      .toBe('/zh/account?view=signin&link_provider=apple&expected_uid=42');
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.linkSocial).not.toHaveBeenCalled();
  });

  it('cancels waiting and ignores a late successful exchange', async () => {
    let resolve!: (value: unknown) => void;
    mocks.loginSocial.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await callback(loginState, loginState);
    expect(host.textContent).toContain('Cancel waiting');
    const signal = mocks.loginSocial.mock.calls[0][4] as AbortSignal;
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    expect(signal.aborted).toBe(true);
    expect(host.textContent).toContain('server may have processed');
    await act(async () => resolve({ token: 'late-session', user: { uid: 1 } }));
    expect(mocks.applySession).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('does not reflect provider error strings or send recovery to an external URL', async () => {
    sessionStorage.setItem('social_oauth_return', 'https://evil.example/account');
    await callback(loginState, loginState, '&error=attacker-controlled-details');
    expect(host.textContent).not.toContain('attacker-controlled-details');
    expect(host.querySelector<HTMLAnchorElement>('a')?.getAttribute('href')).toBe('/account?view=signin');
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('offers retry on exchange failure rather than a permanent spinner', async () => {
    mocks.loginSocial.mockRejectedValue(new Error('Request timed out'));
    await callback(loginState, loginState);
    expect(host.textContent).toContain('Request timed out');
    expect(host.querySelector('a')?.textContent).toContain('retry');
  });

  it('consumes a code only once during StrictMode effect replay', async () => {
    window.history.replaceState({}, '', `/auth/social/callback?code=short-code&state=${loginState}`);
    sessionStorage.setItem('apple_oauth_state', JSON.stringify({ state: loginState, codeVerifier }));
    const { default: Callback } = await import('@/app/auth/social/callback/page');
    await act(async () => root.render(createElement(StrictMode, null, createElement(Callback))));
    expect(mocks.loginSocial).toHaveBeenCalledTimes(1);
    expect(mocks.applySession).toHaveBeenCalledTimes(1);
  });

  it('handles a later visit instead of inheriting a permanent module-level processed flag', async () => {
    await callback(loginState, loginState, '&error=access_denied');
    await act(async () => root.render(null));
    await callback(loginState, loginState);
    expect(mocks.loginSocial).toHaveBeenCalledTimes(1);
    expect(mocks.applySession).toHaveBeenCalledTimes(1);
  });

  it('does not install a late session after navigating away', async () => {
    let resolve!: (value: unknown) => void;
    mocks.loginSocial.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await callback(loginState, loginState);
    const signal = mocks.loginSocial.mock.calls[0][4] as AbortSignal;
    await act(async () => root.render(null));
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ token: 'late', user: { uid: 1 } }));
    expect(mocks.applySession).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
