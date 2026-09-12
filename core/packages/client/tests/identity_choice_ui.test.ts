// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from '@/components/AuthPanel';
import { AccountChoiceRequired, clearIdentityChoice, getIdentityChoice, rememberIdentityChoice, updateIdentityChoice } from '@/lib/identity-choice';

const mocks = vi.hoisted(() => ({
  user: null as null | { uid: number; name: string }, language: 'en' as 'en' | 'zh',
  completeIdentityChoice: vi.fn(), loginGoogle: vi.fn(), applySession: vi.fn(), requestGoogleAssertion: vi.fn(),
}));
vi.mock('@/lib/account-api', async (original) => ({ ...await original(),
  completeIdentityChoice: mocks.completeIdentityChoice, loginGoogle: mocks.loginGoogle,
  fetchAuthProviders: async () => ({ email: false, phone: false, wca: false, apple: true, googleClientId: 'client', googleRelayUrl: 'https://relay.test', social: {} }),
}));
vi.mock('@/lib/google-auth', () => ({ requestGoogleAssertion: mocks.requestGoogleAssertion }));
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: Object.assign((selector: (value: unknown) => unknown) => selector({ user: mocks.user, loginWithWca: vi.fn(), refresh: vi.fn() }), { getState: () => ({ user: mocks.user }) }),
  applySession: mocks.applySession, getSessionToken: () => 'existing-session',
}));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string, en: string) => mocks.language === 'zh' ? zh : en }));
vi.mock('@/i18n/tr', () => ({ useLang: () => mocks.language, tr: (copy: { en: string; zh: string }) => copy[mocks.language] }));

let root: Root;
let host: HTMLDivElement;
const done = vi.fn();
const ticket = 'a'.repeat(43);
const button = (label: string) => Array.from(host.querySelectorAll('button')).find((node) => node.textContent === label)!;
const render = async () => { await act(async () => root.render(createElement(LoginForm, { onDone: done }))); };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear(); clearIdentityChoice();
  window.history.replaceState({}, '', '/account');
  mocks.user = null; mocks.language = 'en';
  mocks.applySession.mockReturnValue(true);
  mocks.requestGoogleAssertion.mockResolvedValue('assertion');
  mocks.completeIdentityChoice.mockResolvedValue({ token: 'canonical-session', user: { uid: 42, name: 'Existing' }, isNew: false });
  rememberIdentityChoice(new AccountChoiceRequired({ ticket, provider: 'apple', expiresInSeconds: 900 }), '/account?auth=mobile&next=%2Fauth%2Fmobile%3FcodeChallenge%3Doriginal');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); clearIdentityChoice(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('one canonical first-identity choice UI', () => {
  it.each([
    ['en', 'Do you have a CubeRoot account?', 'Sign in to an existing account', 'Create a new account'],
    ['zh', '你有 CubeRoot 账号吗？', '登录已有账号', '创建新账号'],
  ] as const)('shows the two concise choices in %s without an automatic mutation', async (language, title, existing, create) => {
    mocks.language = language; await render();
    expect(host.querySelector('h2')?.textContent).toBe(title);
    expect(button(existing)).toBeDefined(); expect(button(create)).toBeDefined();
    expect(mocks.completeIdentityChoice).not.toHaveBeenCalled();
  });
  it('requires two explicit clicks even when a browser account is already signed in', async () => {
    mocks.user = { uid: 42, name: 'Existing' }; await render();
    await act(async () => button('Sign in to an existing account').click());
    expect(host.textContent).toContain('Existing · ID 42');
    expect(mocks.completeIdentityChoice).not.toHaveBeenCalled();
    await act(async () => button('Confirm linking').click());
    expect(mocks.completeIdentityChoice).toHaveBeenCalledExactlyOnceWith(ticket, 'link', 42, expect.any(AbortSignal));
    expect(done).toHaveBeenCalledWith({ isNew: false, hasWca: false }, expect.stringContaining('codeChallenge%3Doriginal'));
    expect(getIdentityChoice()).toBeNull();
  });
  it('creates only after the explicit create button', async () => {
    await render(); await act(async () => button('Create a new account').click());
    expect(mocks.completeIdentityChoice).toHaveBeenCalledExactlyOnceWith(ticket, 'create', undefined, expect.any(AbortSignal));
  });
  it('reuses the original provider form and rejects a second unknown identity', async () => {
    mocks.loginGoogle.mockRejectedValue(new AccountChoiceRequired({ ticket: 'b'.repeat(43), provider: 'google', expiresInSeconds: 900 }));
    await render(); await act(async () => button('Sign in to an existing account').click());
    expect(host.querySelectorAll('[data-mobile-auth-provider="google"]')).toHaveLength(1);
    await act(async () => button('Continue with Google').click());
    expect(getIdentityChoice()?.ticket).toBe(ticket);
    expect(host.textContent).toContain('Use one already linked to your account.');
    expect(mocks.applySession).not.toHaveBeenCalled(); expect(mocks.completeIdentityChoice).not.toHaveBeenCalled();
  });
  it('requires explicit linking after a known provider authenticates the existing account', async () => {
    mocks.loginGoogle.mockResolvedValue({ token: 'known-session', user: { uid: 42 }, isNew: false });
    mocks.applySession.mockImplementation(() => { mocks.user = { uid: 42, name: 'Existing' }; return true; });
    await render(); await act(async () => button('Sign in to an existing account').click());
    await act(async () => button('Continue with Google').click());
    expect(getIdentityChoice()).toMatchObject({ stage: 'confirm', expectedUid: 42 });
    expect(mocks.completeIdentityChoice).not.toHaveBeenCalled(); expect(done).not.toHaveBeenCalled();
    await act(async () => button('Confirm linking').click());
    expect(mocks.completeIdentityChoice).toHaveBeenCalledOnce();
  });
  it('blocks confirmation when another tab changes the current account', async () => {
    mocks.user = { uid: 42, name: 'Existing' }; updateIdentityChoice(ticket, { stage: 'confirm', expectedUid: 42 }); await render();
    mocks.user = { uid: 99, name: 'Other' }; await render();
    expect(button('Confirm linking').disabled).toBe(true);
    expect(host.textContent).toContain('Your account changed');
    expect(mocks.completeIdentityChoice).not.toHaveBeenCalled();
  });
  it('disables cancellation while submitting and ignores a late success after leaving', async () => {
    let resolve!: (value: unknown) => void;
    mocks.completeIdentityChoice.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await render(); await act(async () => button('Create a new account').click());
    const signal = mocks.completeIdentityChoice.mock.calls[0][3] as AbortSignal;
    expect(button('Cancel').disabled).toBe(true);
    await act(async () => root.render(null));
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ token: 'late', user: { uid: 42 } }));
    expect(mocks.applySession).not.toHaveBeenCalled(); expect(done).not.toHaveBeenCalled();
  });
  it('does not replace a changed account with a late link response', async () => {
    let resolve!: (value: unknown) => void;
    mocks.completeIdentityChoice.mockImplementation(() => new Promise((done) => { resolve = done; }));
    mocks.user = { uid: 42, name: 'Existing' }; updateIdentityChoice(ticket, { stage: 'confirm', expectedUid: 42 }); await render();
    await act(async () => button('Confirm linking').click());
    mocks.user = { uid: 99, name: 'Other' };
    await act(async () => resolve({ token: 'old-account', user: { uid: 42 } }));
    expect(mocks.applySession).not.toHaveBeenCalled(); expect(done).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Your account changed');
  });
  it('clears an expired choice and restores normal login', async () => {
    vi.useFakeTimers(); await render();
    await act(async () => { await vi.advanceTimersByTimeAsync(900_001); });
    expect(getIdentityChoice()).toBeNull();
    expect(host.textContent).toContain('Continue with Apple');
    expect(mocks.completeIdentityChoice).not.toHaveBeenCalled();
  });
});
