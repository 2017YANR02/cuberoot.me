// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountPanel } from '@/components/AuthPanel';

const mocks = vi.hoisted(() => ({
  user: { uid: 42, name: 'Existing' }, language: 'en' as 'en' | 'zh',
  issueIdentityLinkCode: vi.fn(), issueAccountMergeCode: vi.fn(), mergeAccount: vi.fn(), applySession: vi.fn(),
}));
vi.mock('@/lib/account-api', async (original) => ({ ...await original(),
  issueIdentityLinkCode: mocks.issueIdentityLinkCode, issueAccountMergeCode: mocks.issueAccountMergeCode, mergeAccount: mocks.mergeAccount,
  fetchIdentities: async () => ({ identities: [{ provider: 'email', providerUid: 'existing@example.test', createdAt: '' }], hasPassword: false, canResetPassword: false }),
  fetchAuthProviders: async () => ({ email: true, phone: false, wca: false, apple: false, googleClientId: null, googleRelayUrl: null, social: {} }),
}));
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: Object.assign((selector: (value: unknown) => unknown) => selector({ user: mocks.user, loginWithWca: vi.fn() }), { getState: () => ({ user: mocks.user }) }),
  applySession: mocks.applySession, getSessionToken: () => 'existing-session',
}));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string, en: string) => mocks.language === 'zh' ? zh : en }));
vi.mock('@/i18n/tr', () => ({ useLang: () => mocks.language, tr: (copy: { en: string; zh: string }) => copy[mocks.language] }));

let root: Root;
let host: HTMLDivElement;
const button = (label: string) => Array.from(host.querySelectorAll('button')).find((node) => node.textContent === label)!;
const render = async () => { await act(async () => root.render(createElement(AccountPanel))); };
const enterMergeCode = async (code: string) => {
  const input = host.querySelector<HTMLInputElement>('input[aria-label="Merge code"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, code);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const openMove = async () => {
  await act(async () => button('Open').click());
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Choose merge direction"]')!.click());
  await enterMergeCode('99-123456');
};
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.user = { uid: 42, name: 'Existing' }; mocks.language = 'en';
  mocks.issueIdentityLinkCode.mockResolvedValue({ linkCode: 'L42-123456', expiresInSeconds: 600 });
  mocks.issueAccountMergeCode.mockResolvedValue({ code: '42-123456', expiresInSeconds: 600 });
  mocks.mergeAccount.mockResolvedValue({ token: 'merged-session', user: { uid: 99, name: 'Kept' } });
  mocks.applySession.mockReturnValue(true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('explicit mini program account linking proof', () => {
  it.each(['en', 'zh'] as const)('does not issue a code on account view or disclosure expansion (%s)', async (language) => {
    mocks.language = language; await render();
    expect(host.querySelector('details')?.open).toBe(false);
    await act(async () => host.querySelector('summary')!.click());
    expect(mocks.issueIdentityLinkCode).not.toHaveBeenCalled();
    expect(host.textContent).toContain('ID 42');
  });
  it('issues only on request and clearly separates the linking code from account merging', async () => {
    await render(); await act(async () => button('Generate linking code').click());
    expect(mocks.issueIdentityLinkCode).toHaveBeenCalledExactlyOnceWith(42, expect.any(AbortSignal));
    expect(host.querySelector<HTMLInputElement>('[aria-label="Mini program linking code"]')?.value).toBe('L42-123456');
    expect(host.textContent).toContain('It is not a merge code.');
    expect(host.textContent).toContain('Do not screenshot, forward or share it.');
    expect(mocks.mergeAccount).not.toHaveBeenCalled();
  });
  it('removes an expired linking code', async () => {
    vi.useFakeTimers(); await render(); await act(async () => button('Generate linking code').click());
    await act(async () => { await vi.advanceTimersByTimeAsync(600_000); });
    expect(host.querySelector('[aria-label="Mini program linking code"]')).toBeNull();
  });
  it('ignores late code issuance after the account changes', async () => {
    let resolve!: (value: unknown) => void;
    mocks.issueIdentityLinkCode.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await render(); await act(async () => button('Generate linking code').click());
    mocks.user = { uid: 99, name: 'Other' }; await render();
    await act(async () => resolve({ linkCode: 'L42-123456', expiresInSeconds: 600 }));
    expect(host.querySelector('[aria-label="Mini program linking code"]')).toBeNull();
    expect(button('Generate linking code').disabled).toBe(false);
  });
  it('offers manual copy when clipboard access is unavailable', async () => {
    await render(); await act(async () => button('Generate linking code').click());
    await act(async () => button('Copy linking code').click());
    expect(host.textContent).toContain('Select the code and copy it manually.');
  });
});

describe('explicit irreversible account merge confirmation', () => {
  it('binds code issuance to the displayed account', async () => {
    await render(); await act(async () => button('Open').click());
    await act(async () => button('Generate merge code').click());
    expect(mocks.issueAccountMergeCode).toHaveBeenCalledExactlyOnceWith(42);
    expect(host.querySelector<HTMLInputElement>('[aria-label="Merge code"]')?.value).toBe('42-123456');
    expect(mocks.mergeAccount).not.toHaveBeenCalled();
  });
  it('does not generate a merge code after an unrendered account switch', async () => {
    await render(); await act(async () => button('Open').click());
    mocks.user = { uid: 77, name: 'Other' };
    await act(async () => button('Generate merge code').click());
    expect(mocks.issueAccountMergeCode).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="Merge code"]')).toBeNull();
    expect(mocks.mergeAccount).not.toHaveBeenCalled();
  });
  it('does not display a code issued for a different account', async () => {
    mocks.issueAccountMergeCode.mockResolvedValue({ code: '99-123456', expiresInSeconds: 600 });
    await render(); await act(async () => button('Open').click());
    await act(async () => button('Generate merge code').click());
    expect(host.querySelector('[aria-label="Merge code"]')).toBeNull();
    expect(host.textContent).toContain('Your account changed.');
    expect(mocks.mergeAccount).not.toHaveBeenCalled();
  });
  it('shows current identity and requires review followed by separate confirmation', async () => {
    await render(); await openMove();
    expect(host.textContent).toContain('Current account: ID 42');
    expect(mocks.mergeAccount).not.toHaveBeenCalled();
    await act(async () => button('Review merge direction').click());
    expect(host.textContent).toContain('Account ID 42 will be merged into the account specified by the merge code.');
    expect(host.textContent).toContain('This cannot be undone.');
    expect(mocks.mergeAccount).not.toHaveBeenCalled();
    await act(async () => button('Confirm irreversible merge').click());
    expect(mocks.mergeAccount).toHaveBeenCalledExactlyOnceWith('99-123456', 42);
  });
  it('changing the code or canceling discards the confirmation', async () => {
    await render(); await openMove();
    await act(async () => button('Review merge direction').click());
    await enterMergeCode('77-654321');
    expect(button('Confirm irreversible merge')).toBeUndefined();
    await act(async () => button('Review merge direction').click());
    await act(async () => button('Cancel').click());
    expect(button('Review merge direction')).toBeDefined();
    expect(mocks.mergeAccount).not.toHaveBeenCalled();
  });
  it('does not replace an account changed during an in-flight merge', async () => {
    let resolve!: (value: unknown) => void;
    mocks.mergeAccount.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await render(); await openMove(); await act(async () => button('Review merge direction').click());
    await act(async () => button('Confirm irreversible merge').click());
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Choose merge direction"]')?.disabled).toBe(true);
    mocks.user = { uid: 77, name: 'Other' }; await render();
    await act(async () => resolve({ token: 'late', user: { uid: 99 } }));
    expect(mocks.applySession).not.toHaveBeenCalled();
  });
  it('does not submit when another tab changes the account before the confirmation click', async () => {
    await render(); await openMove(); await act(async () => button('Review merge direction').click());
    mocks.user = { uid: 77, name: 'Other' };
    await act(async () => button('Confirm irreversible merge').click());
    expect(mocks.mergeAccount).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Your account changed.');
  });
});
