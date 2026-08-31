// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { mobileEmbedAccountAuthRequest } from '@/lib/mobile-embed-auth';

describe('mobile Account login delegation', () => {
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
        <button data-mobile-auth-provider="github" id="invalid">invalid</button>
      </div>
      <button id="outside">outside</button>
    `;
    expect(mobileEmbedAccountAuthRequest(document.getElementById('wca'))?.provider).toBe('wca');
    expect(mobileEmbedAccountAuthRequest(document.getElementById('invalid'))?.provider).toBeNull();
    expect(mobileEmbedAccountAuthRequest(document.getElementById('outside'))).toBeNull();
  });
});
