// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { mobileEmbedAccountAuthRequest } from '@/lib/mobile-embed-auth';

const bridgeSource = readFileSync(resolve('components/MobileEmbedBridge.tsx'), 'utf8');

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

  it('sends nothing to an untrusted parent before an origin-bound init handshake', () => {
    expect(bridgeSource).toContain('let parentOrigin: string | null = null');
    expect(bridgeSource).toContain('const init = decodeMobileEmbedInit(event.data)');
    expect(bridgeSource).toContain('parentOrigin = event.origin');
    expect(bridgeSource).not.toMatch(/postMessage\([^)]*,\s*['"]\*['"]\)/);
  });
});
