// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from '@/components/AuthPanel';
import { AccountChoiceRequired, clearIdentityChoice, getIdentityChoice, rememberIdentityChoice, updateIdentityChoice } from '@/lib/identity-choice';

const mocks = vi.hoisted(() => ({
  user: null as null | { uid: number; name: string }, language: 'en' as 'en' | 'zh',
  completeIdentityChoice: vi.fn(), loginGoogle: vi.fn(), applySession: vi.fn(), requestGoogleAssertion: vi.fn(),
  credentials: false, sendEmailCode: vi.fn(), sendPhoneCode: vi.fn(), verifyEmailCode: vi.fn(), verifyPhoneCode: vi.fn(),
}));
vi.mock('@/lib/account-api', async (original) => ({ ...await original(),
  completeIdentityChoice: mocks.completeIdentityChoice, loginGoogle: mocks.loginGoogle,
  sendEmailCode: mocks.sendEmailCode, sendPhoneCode: mocks.sendPhoneCode, verifyEmailCode: mocks.verifyEmailCode, verifyPhoneCode: mocks.verifyPhoneCode,
  fetchAuthProviders: async () => ({ email: mocks.credentials, phone: mocks.credentials, wca: false, apple: true, googleClientId: 'client', googleRelayUrl: 'https://relay.test', social: {} }),
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
  mocks.user = null; mocks.language = 'en'; mocks.credentials = false;
  mocks.applySession.mockReturnValue(true);
  mocks.requestGoogleAssertion.mockResolvedValue('assertion');
  mocks.completeIdentityChoice.mockResolvedValue({ token: 'canonical-session', user: { uid: 42, name: 'Existing' }, isNew: false });
  mocks.sendEmailCode.mockResolvedValue({ ok: true }); mocks.sendPhoneCode.mockResolvedValue({ ok: true });
  mocks.verifyEmailCode.mockReset(); mocks.verifyPhoneCode.mockReset();
  rememberIdentityChoice(new AccountChoiceRequired({ ticket, provider: 'apple', expiresInSeconds: 900 }), '/account?auth=mobile&next=%2Fauth%2Fmobile%3FcodeChallenge%3Doriginal');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});

const fill = async (selector: string, value: string) => {
  const input = host.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const enterCredential = async (provider: 'email' | 'phone') => {
  if (provider === 'phone') await act(async () => button('Use phone number').click());
  await fill(`input[type="${provider === 'email' ? 'email' : 'tel'}"]`, provider === 'email' ? 'new@example.test' : '13800138000');
  await act(async () => button('Send code').click());
  await fill('input[autocomplete="one-time-code"]', '123456');
};

describe('verified email and phone use the canonical choice UI', () => {
  beforeEach(() => { clearIdentityChoice(); mocks.credentials = true; });
  it.each(['email', 'phone'] as const)('does not silently create a new account after %s verification', async (provider) => {
    const verify = provider === 'email' ? mocks.verifyEmailCode : mocks.verifyPhoneCode;
    verify.mockRejectedValue(new AccountChoiceRequired({ ticket, provider, expiresInSeconds: 900 }));
    await render(); await enterCredential(provider);
    expect(getIdentityChoice()).toMatchObject({ provider, stage: 'choose' });
    expect(button('Sign in to an existing account')).toBeDefined();
    expect(mocks.applySession).not.toHaveBeenCalled(); expect(done).not.toHaveBeenCalled();
    await act(async () => button('Cancel').click());
    expect(getIdentityChoice()).toBeNull(); expect(mocks.completeIdentityChoice).not.toHaveBeenCalled();
  });
  it.each(['email', 'phone'] as const)('signs a known %s identity in without another question', async (provider) => {
    const verify = provider === 'email' ? mocks.verifyEmailCode : mocks.verifyPhoneCode;
    verify.mockResolvedValue({ token: 'known', user: { uid: 42 }, isNew: false });
    await render(); await enterCredential(provider);
    expect(mocks.applySession).toHaveBeenCalledExactlyOnceWith('known', { uid: 42 });
    expect(done).toHaveBeenCalledExactlyOnceWith({ isNew: false, hasWca: false });
    expect(getIdentityChoice()).toBeNull();
  });
  it.each(['email', 'phone'] as const)('ignores a late %s choice after leaving the credential screen', async (provider) => {
    let reject!: (value: unknown) => void;
    const verify = provider === 'email' ? mocks.verifyEmailCode : mocks.verifyPhoneCode;
    verify.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    await render(); await enterCredential(provider);
    const signal = verify.mock.calls[0][2].signal as AbortSignal;
    await act(async () => root.render(null));
    expect(signal.aborted).toBe(true);
    await act(async () => reject(new AccountChoiceRequired({ ticket, provider, expiresInSeconds: 900 })));
    expect(getIdentityChoice()).toBeNull(); expect(mocks.applySession).not.toHaveBeenCalled();
  });
  it('keeps email password recovery existing-only and does not offer registration', async () => {
    mocks.verifyEmailCode.mockRejectedValue(new Error('account not found'));
    await render();
    await act(async () => button('Sign in with a password').click());
    await act(async () => button('Forgot your password?').click());
    await enterCredential('email');
    expect(mocks.verifyEmailCode).toHaveBeenCalledWith('new@example.test', '123456', { existingOnly: true, signal: expect.any(AbortSignal) });
    expect(getIdentityChoice()).toBeNull(); expect(mocks.applySession).not.toHaveBeenCalled();
  });
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
  it.each([
    ['email', 'email', 'Your account already has another email. Change it in account settings.'],
    ['phone', 'phone number', 'Your account already has another phone number. Change it in account settings.'],
  ] as const)('explains a conflicting existing %s without advising unsafe unlinking', async (provider, label, message) => {
    clearIdentityChoice();
    rememberIdentityChoice(new AccountChoiceRequired({ ticket, provider, expiresInSeconds: 900 }), '/account');
    mocks.user = { uid: 42, name: 'Existing' };
    mocks.completeIdentityChoice.mockRejectedValue(new Error(provider === 'email' ? 'account already has an email; change it in account settings' : 'account already has a phone; change it in account settings'));
    updateIdentityChoice(ticket, { stage: 'confirm', expectedUid: 42 });
    await render();
    expect(host.querySelector('h2')?.textContent).toBe(`Link ${label}`);
    await act(async () => button('Confirm linking').click());
    expect(host.textContent).toContain(message);
    expect(mocks.applySession).not.toHaveBeenCalled();
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
