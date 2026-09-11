// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm, AccountPanel } from '@/components/AuthPanel';
import { mobileEmbedAccountAuthRequest } from '@/lib/mobile-embed-auth';

const mocks = vi.hoisted(() => ({
  fetchAuthProviders: vi.fn(), fetchIdentities: vi.fn(), startSocialLogin: vi.fn(), unlinkIdentity: vi.fn(),
  uid: 42,
  language: 'en' as 'en' | 'zh',
}));
vi.mock('@/lib/account-api', async (original) => ({ ...await original(), ...mocks }));
vi.mock('@/lib/social-auth', async (original) => ({ ...await original(), startSocialLogin: mocks.startSocialLogin }));
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: Object.assign((selector: (state: unknown) => unknown) => selector({ user: { uid: mocks.uid }, loginWithWca: vi.fn(), refresh: vi.fn() }), { getState: () => ({ user: { uid: mocks.uid } }) }),
  getSessionToken: () => null, applySession: vi.fn(),
}));
vi.mock('@/i18n/tr', () => ({ useLang: () => mocks.language, tr: (copy: { en: string; zh: string }) => copy[mocks.language] }));

let root: Root;
let host: HTMLDivElement;
const providers = { email: false, phone: false, wca: false, apple: true, googleClientId: null, googleRelayUrl: null, social: {} };
const appleButton = () => host.querySelector<HTMLButtonElement>('[data-mobile-auth-provider="apple"]');

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  mocks.language = 'en';
  mocks.fetchAuthProviders.mockResolvedValue(providers);
  mocks.fetchIdentities.mockResolvedValue({ identities: [], hasPassword: false, canResetPassword: false });
  mocks.startSocialLogin.mockResolvedValue({ navigated: true });
  host = document.createElement('div');
  host.dataset.mobileAuthEntry = '';
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('canonical Apple login and identity UI', () => {
  it('renders the real SSO button, delegates App login, and starts the existing redirect flow', async () => {
    await act(async () => root.render(createElement(LoginForm, { onDone: vi.fn() })));
    expect(appleButton()?.textContent).toBe('Continue with Apple');
    expect(mobileEmbedAccountAuthRequest(appleButton())?.provider).toBe('apple');
    await act(async () => appleButton()?.click());
    expect(mocks.startSocialLogin).toHaveBeenCalledExactlyOnceWith('apple', 'login', undefined, expect.any(AbortSignal));
  });

  it.each([false, undefined])('does not offer an unconfigured Apple provider (%s)', async (apple) => {
    mocks.fetchAuthProviders.mockResolvedValue({ ...providers, apple });
    await act(async () => root.render(createElement(LoginForm, { onDone: vi.fn() })));
    expect(appleButton()).toBeNull();
  });

  it('preserves the first-party-only mobile handoff', async () => {
    await act(async () => root.render(createElement(LoginForm, { onDone: vi.fn(), firstPartyOnly: true })));
    expect(appleButton()).toBeNull();
  });

  it('shows an error and makes the button usable again when authorization fails', async () => {
    mocks.startSocialLogin.mockRejectedValue(new Error('apple not configured'));
    await act(async () => root.render(createElement(LoginForm, { onDone: vi.fn() })));
    await act(async () => appleButton()?.click());
    expect(host.textContent).toContain("This sign-in method isn't available yet");
    expect(appleButton()?.disabled).toBe(false);
  });

  it('cancels a pending provider request and permits a fresh click', async () => {
    mocks.startSocialLogin.mockReturnValue(new Promise(() => {}));
    await act(async () => root.render(createElement(LoginForm, { onDone: vi.fn() })));
    await act(async () => appleButton()?.click());
    const signal = mocks.startSocialLogin.mock.calls[0][3] as AbortSignal;
    const cancel = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Cancel waiting')!;
    await act(async () => cancel.click());
    expect(signal.aborted).toBe(true);
    expect(appleButton()?.disabled).toBe(false);
    await act(async () => appleButton()?.click());
    expect(mocks.startSocialLogin).toHaveBeenCalledTimes(2);
  });

  it.each([
    { language: 'en' as const, expected: 'Service temporarily unavailable — please try again' },
    { language: 'zh' as const, expected: '服务暂时不可用,请稍后重试' },
  ])('localizes the actual Apple 502 error and permits retry in $language', async ({ language, expected }) => {
    mocks.language = language;
    mocks.startSocialLogin.mockRejectedValue(new Error('apple service unavailable; please retry'));
    await act(async () => root.render(createElement(LoginForm, { onDone: vi.fn() })));
    await act(async () => appleButton()!.click());
    expect(host.querySelector('.auth-sso-error')?.textContent).toBe(expected);
    expect(host.textContent).not.toContain('apple service unavailable');
    expect(appleButton()?.disabled).toBe(false);
    await act(async () => appleButton()!.click());
    expect(mocks.startSocialLogin).toHaveBeenCalledTimes(2);
  });

  it('restores the sign-in button after browser back/forward cache restoration', async () => {
    await act(async () => root.render(createElement(LoginForm, { onDone: vi.fn() })));
    await act(async () => appleButton()?.click());
    expect(appleButton()?.disabled).toBe(true);
    await act(async () => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    expect(appleButton()?.disabled).toBe(false);
  });

  it('links Apple using the existing account identity row', async () => {
    await act(async () => root.render(createElement(AccountPanel)));
    const row = Array.from(host.querySelectorAll('.auth-idrow')).find((el) => el.textContent === 'AppleLink');
    expect(row).toBeDefined();
    await act(async () => row?.querySelector<HTMLButtonElement>('button')?.click());
    expect(mocks.startSocialLogin).toHaveBeenCalledExactlyOnceWith('apple', 'link', 42, expect.any(AbortSignal));
  });

  it('cancels pending account linking and keeps a newer attempt busy after a late completion', async () => {
    let finishFirst!: (result: { navigated: boolean }) => void;
    mocks.startSocialLogin.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve; }))
      .mockReturnValueOnce(new Promise(() => {}));
    await act(async () => root.render(createElement(AccountPanel)));
    const button = host.querySelector<HTMLButtonElement>('[data-mobile-account-link="apple"]')!;
    await act(async () => button.click());
    const firstSignal = mocks.startSocialLogin.mock.calls[0][3] as AbortSignal;
    expect(button.disabled).toBe(true);
    await act(async () => Array.from(host.querySelectorAll('button')).find((el) => el.textContent === 'Cancel waiting')!.click());
    expect(firstSignal.aborted).toBe(true);
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    await act(async () => finishFirst({ navigated: false }));
    expect(button.disabled).toBe(true);
    expect((mocks.startSocialLogin.mock.calls[1][3] as AbortSignal).aborted).toBe(false);
  });

  it('aborts account linking when the account panel unmounts', async () => {
    let finish!: (result: { navigated: boolean }) => void;
    mocks.startSocialLogin.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await act(async () => root.render(createElement(AccountPanel)));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-mobile-account-link="apple"]')!.click());
    const signal = mocks.startSocialLogin.mock.calls[0][3] as AbortSignal;
    await act(async () => root.render(null));
    expect(signal.aborted).toBe(true);
    await act(async () => finish({ navigated: true }));
    expect(host.textContent).toBe('');
  });

  it('restores the account linking button after browser back/forward cache restoration', async () => {
    await act(async () => root.render(createElement(AccountPanel)));
    const button = host.querySelector<HTMLButtonElement>('[data-mobile-account-link="apple"]')!;
    await act(async () => button.click());
    expect(button.disabled).toBe(true);
    await act(async () => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    expect(button.disabled).toBe(false);
    expect((mocks.startSocialLogin.mock.calls[0][3] as AbortSignal).aborted).toBe(true);
    await act(async () => button.click());
    expect(mocks.startSocialLogin).toHaveBeenCalledTimes(2);
  });

  it('does not present failed identity loading as an account with no methods and can retry', async () => {
    mocks.fetchIdentities.mockRejectedValueOnce(new Error('offline'));
    await act(async () => root.render(createElement(AccountPanel)));
    expect(host.textContent).toContain('Could not load account details');
    expect(host.textContent).not.toContain('No linked login methods yet');
    expect(host.querySelector('[data-mobile-account-link="apple"]')).toBeNull();
    const retry = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Retry')!;
    await act(async () => retry.click());
    expect(host.textContent).not.toContain('Could not load account details');
    expect(host.querySelector('[data-mobile-account-link="apple"]')).not.toBeNull();
  });

  it.each([7, null])('blocks App linking when browser authentication does not match expected uid %s', async (expectedAppleUid) => {
    await act(async () => root.render(createElement(AccountPanel, { expectedAppleUid })));
    expect(host.textContent).toContain('This browser account differs from the app');
    const button = host.querySelector<HTMLButtonElement>('[data-mobile-account-link="apple"]');
    expect(button?.disabled).toBe(true);
    await act(async () => button?.click());
    expect(mocks.startSocialLogin).not.toHaveBeenCalled();
  });

  it('requires a real user click after independently authenticating the matching browser account', async () => {
    await act(async () => root.render(createElement(AccountPanel, { expectedAppleUid: 42 })));
    expect(mocks.startSocialLogin).not.toHaveBeenCalled();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-mobile-account-link="apple"]')?.click());
    expect(mocks.startSocialLogin).toHaveBeenCalledExactlyOnceWith('apple', 'link', 42, expect.any(AbortSignal));
  });

  it('shows an existing Apple identity without exposing its opaque subject or offering duplicate linking', async () => {
    mocks.fetchIdentities.mockResolvedValue({ identities: [{ provider: 'apple', providerUid: 'private-apple-subject' }], hasPassword: false, canResetPassword: false });
    await act(async () => root.render(createElement(AccountPanel)));
    expect(host.textContent).not.toContain('private-apple-subject');
    expect(Array.from(host.querySelectorAll('.auth-idprov')).filter((el) => el.textContent === 'Apple')).toHaveLength(1);
    expect(host.querySelector<HTMLButtonElement>('.auth-unlink')?.disabled).toBe(true);
  });
});
