// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Callback from '@/app/auth/wechat/mobile/page';
import { AccountChoiceRequired, clearIdentityChoice, rememberIdentityChoice, updateIdentityChoice } from '@/lib/identity-choice';

const mocks = vi.hoisted(() => ({ exchangeWechatBrowserLogin: vi.fn(), startWechatBrowserLogin: vi.fn(), applySession: vi.fn() }));
vi.mock('@/lib/account-api', () => mocks);
vi.mock('@/lib/auth-store', () => ({ applySession: mocks.applySession, getSessionToken: () => 'canonical' }));
vi.mock('@/lib/social-auth', () => ({ takeSocialReturnUrl: () => '/account' }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
let root: Root; let host: HTMLDivElement;
const ticket = 'a'.repeat(43);
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear(); clearIdentityChoice(); window.history.replaceState({}, '', '/auth/wechat/mobile');
  rememberIdentityChoice(new AccountChoiceRequired({ ticket, provider: 'apple', expiresInSeconds: 900 }), '/account');
  updateIdentityChoice(ticket, { stage: 'authenticate' });
  sessionStorage.setItem('wechat_browser_login', JSON.stringify({ ticket: 'w'.repeat(43), urlLink: 'https://wxaurl.cn/test', expiresAt: Date.now() + 600_000, expiresIn: 600, existingOnly: true }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); clearIdentityChoice(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('WeChat browser existing-account response generation', () => {
  it.each(['cancel', 'replace', 'expire'] as const)('does not install a late mini session after %s of the original choice', async (change) => {
    let resolve!: (value: unknown) => void;
    mocks.exchangeWechatBrowserLogin.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await act(async () => root.render(createElement(Callback)));
    expect(mocks.startWechatBrowserLogin).not.toHaveBeenCalled();
    expect(mocks.exchangeWechatBrowserLogin).toHaveBeenCalledOnce();
    if (change === 'expire') {
      const expired = Date.now() + 900_001; vi.spyOn(Date, 'now').mockReturnValue(expired);
    } else {
      clearIdentityChoice();
      if (change === 'replace') {
        rememberIdentityChoice(new AccountChoiceRequired({ ticket: 'b'.repeat(43), provider: 'google', expiresInSeconds: 900 }), '/other');
        updateIdentityChoice('b'.repeat(43), { stage: 'authenticate' });
      }
    }
    await act(async () => resolve({ token: 'canonical', user: { uid: 42 }, isNew: false }));
    expect(mocks.applySession).not.toHaveBeenCalled();
    expect(host.textContent).toContain('WeChat confirmation expired');
    expect(sessionStorage.getItem('wechat_browser_login')).toBeNull();
  });
});
