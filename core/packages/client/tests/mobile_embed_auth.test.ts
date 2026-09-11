// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { isMobileEmbedAppleLink, mobileEmbedAccountAuthRequest, mobileEmbedSupportsApple } from '@/lib/mobile-embed-auth';
import {
  decodeMobileEmbedAccountManage, decodeMobileEmbedAccountManageResult, decodeMobileEmbedInit,
  mobileEmbedAccountManageMessage, mobileEmbedAccountManageResultMessage, mobileEmbedInitMessage,
} from '@cuberoot/shared/mobile-embed';

const bridgeSource = readFileSync(resolve('components/MobileEmbedBridge.tsx'), 'utf8');

describe('mobile Account login delegation', () => {
  it('fails closed for Apple on older hosts without explicit provider capability', () => {
    expect(mobileEmbedSupportsApple(null)).toBe(false);
    expect(mobileEmbedSupportsApple(mobileEmbedInitMessage('account'))).toBe(false);
    const current = mobileEmbedInitMessage('account', { authProviders: ['apple'], accountManagement: true });
    expect(mobileEmbedSupportsApple(current)).toBe(true);
    expect(mobileEmbedSupportsApple(current, true)).toBe(true);
    expect(mobileEmbedSupportsApple({ ...current, accountManagement: false }, true)).toBe(false);
    expect(decodeMobileEmbedInit({ ...current, authProviders: ['unknown'] })).toBeNull();
  });

  it('keeps account linking separate from login and passes no session tokens', () => {
    document.body.innerHTML = '<button data-mobile-account-link="apple"><span id="link">Link</span></button>';
    expect(isMobileEmbedAppleLink(document.getElementById('link'))).toBe(true);
    expect(mobileEmbedAccountAuthRequest(document.getElementById('link'))).toBeNull();
    const request = mobileEmbedAccountManageMessage(42, 'request-1234');
    expect(decodeMobileEmbedAccountManage({ ...request, token: 'must-never-cross' })).toEqual(request);
    expect(request.intent).toBe('link');
    for (const invalid of [{ expectedUid: 0 }, { expectedUid: 1.2 }, { provider: 'google' }, { intent: 'login' }, { requestId: '' }]) {
      expect(decodeMobileEmbedAccountManage({ ...request, ...invalid })).toBeNull();
    }
    const result = mobileEmbedAccountManageResultMessage(false, request.requestId);
    expect(decodeMobileEmbedAccountManageResult(result)).toEqual(result);
    expect(decodeMobileEmbedAccountManageResult({ ...result, ok: 'true' })).toBeNull();
  });
  it('delegates email, phone, and password interactions to the first-party Browser flow', () => {
    document.body.innerHTML = `
      <div data-mobile-auth-entry>
        <input id="email" type="email">
        <button id="phone" type="button">phone</button>
        <button id="password" type="button">password</button>
      </div>
    `;
    for (const id of ['email', 'phone', 'password']) {
      expect(mobileEmbedAccountAuthRequest(document.getElementById(id))).toEqual({
        provider: null,
        surface: 'account',
        type: 'cuberoot:mobile:auth-request',
      });
    }
  });

  it('preserves supported SSO providers and rejects interactions outside LoginForm', () => {
    document.body.innerHTML = `
      <div data-mobile-auth-entry>
        <button data-mobile-auth-provider="wca"><span id="wca">WCA</span></button>
        <button data-mobile-auth-provider="apple"><span id="apple">Apple</span></button>
        <button data-mobile-auth-provider="github" id="invalid">invalid</button>
      </div>
      <button id="outside">outside</button>
    `;
    expect(mobileEmbedAccountAuthRequest(document.getElementById('wca'))?.provider).toBe('wca');
    expect(mobileEmbedAccountAuthRequest(document.getElementById('apple'))?.provider).toBe('apple');
    expect(mobileEmbedAccountAuthRequest(document.getElementById('invalid'))?.provider).toBeNull();
    expect(mobileEmbedAccountAuthRequest(document.getElementById('outside'))).toBeNull();
  });

  it('sends nothing to an untrusted parent before an origin-bound init handshake', () => {
    expect(bridgeSource).toContain('let parentOrigin: string | null = null');
    expect(bridgeSource).toContain('const init = decodeMobileEmbedInit(event.data)');
    expect(bridgeSource).toContain('parentOrigin = event.origin');
    expect(bridgeSource).not.toMatch(/postMessage\([^)]*,\s*['"]\*['"]\)/);
  });

  it('keeps external navigation in the installed host', () => {
    expect(bridgeSource).toContain('mobileEmbedExternalMessage(surface, next.href)');
    expect(bridgeSource).toContain("next.origin !== window.location.origin || anchor.target === '_blank'");
    expect(bridgeSource).toContain('if (!isMobileEmbedExternalHref(next.href)) return');
    expect(bridgeSource).toContain('event.preventDefault()');
  });
});
