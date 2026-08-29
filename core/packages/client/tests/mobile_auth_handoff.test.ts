import { describe, expect, it, vi } from 'vitest';
import {
  decodeMobileAuthCallback,
  decodeMobileAuthRequest,
  isMobileAuthCallbackUrl,
} from '@cuberoot/shared/auth/web-session';
import {
  issueMobileAuthTicket,
  mobileAuthAccountHref,
  mobileAuthCallbackHref,
  mobileAuthRequestPath,
} from '@/lib/mobile-auth-handoff';

const CHALLENGE = 'C'.repeat(43);
const STATE = 'S'.repeat(43);
const TICKET = 'T'.repeat(43);
const CALLBACK = 'me.cuberoot.app://auth/callback';

function request(language: 'en' | 'zh' = 'en') {
  return {
    callbackUrl: CALLBACK,
    codeChallenge: CHALLENGE,
    language,
    state: STATE,
  } as const;
}

describe('mobile auth browser handoff', () => {
  it('accepts only the registered production and debug callbacks', () => {
    expect(isMobileAuthCallbackUrl(CALLBACK)).toBe(true);
    expect(isMobileAuthCallbackUrl('me.cuberoot.app.debug://auth/callback')).toBe(true);
    expect(isMobileAuthCallbackUrl('https://evil.example/auth/callback')).toBe(false);
    expect(isMobileAuthCallbackUrl('me.cuberoot.app://other/callback')).toBe(false);
    expect(isMobileAuthCallbackUrl('me.cuberoot.app://auth/callback?ticket=x')).toBe(false);
  });

  it('decodes a complete PKCE request and rejects malformed values', () => {
    const search = new URLSearchParams({
      callback_url: CALLBACK,
      code_challenge: CHALLENGE,
      lang: 'zh',
      state: STATE,
    });
    expect(decodeMobileAuthRequest(search.toString())).toEqual(request('zh'));
    search.set('code_challenge', 'short');
    expect(decodeMobileAuthRequest(search.toString())).toBeNull();
  });

  it('preserves the request through the existing account page', () => {
    const path = mobileAuthRequestPath(request('zh'));
    const account = new URL(mobileAuthAccountHref(request('zh')), 'https://cuberoot.me');
    expect(account.pathname).toBe('/zh/account');
    expect(account.searchParams.get('auth')).toBe('mobile');
    expect(account.searchParams.get('next')).toBe(path);
  });

  it('returns only a one-time ticket and state to the app', () => {
    const callback = mobileAuthCallbackHref(request(), TICKET);
    expect(decodeMobileAuthCallback(callback)).toEqual({ ticket: TICKET, state: STATE });
    expect(decodeMobileAuthCallback(`${callback}&extra=value`)).toBeNull();
    expect(callback).not.toContain(CHALLENGE);
  });

  it('issues the mobile ticket with the website bearer session', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ ticket: TICKET, expiresIn: 90 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(issueMobileAuthTicket(request(), 'website-token', fetcher)).resolves.toEqual({
      ticket: TICKET,
      expiresIn: 90,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.cuberoot.me/v1/auth/mobile-session/ticket');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer website-token');
    expect(JSON.parse(String(init?.body))).toEqual({ codeChallenge: CHALLENGE });
    expect(init?.cache).toBe('no-store');
  });
});
