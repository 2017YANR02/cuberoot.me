import { createHash, generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'apple-unit-test-state-secret' }));
// Ephemeral test-only keypairs; no signing material is written to disk or printed.
const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'test-apple-key', alg: 'RS256', use: 'sig' };
const appleIssuer = 'https://appleid.apple.com';
const clientId = 'me.cuberoot.web.test';
const codeVerifier = Buffer.alloc(32, 23).toString('base64url');
const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
const fetchMock = vi.fn();
let apple: typeof import('../src/utils/apple_login.js');

function identityToken(nonce: string, claims: Record<string, unknown> = {}) {
  const payload = { sub: 'test-apple-sub', iss: appleIssuer, aud: clientId,
    exp: Math.floor(Date.now() / 1000) + 300, nonce, ...claims };
  return jwt.sign(Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)), rsa.privateKey,
  { algorithm: 'RS256', keyid: jwk.kid });
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('JWT_SECRET', 'apple-unit-test-state-secret');
  vi.stubEnv('APPLE_LOGIN_ENABLED', '1');
  vi.stubEnv('APPLE_CLIENT_ID', clientId);
  vi.stubEnv('APPLE_TEAM_ID', 'TESTTEAM01');
  vi.stubEnv('APPLE_KEY_ID', 'TESTKEY001');
  vi.stubEnv('APPLE_PRIVATE_KEY', ec.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
  vi.stubEnv('APPLE_REDIRECT_URI', 'https://api.cuberoot.me/v1/auth/apple/callback');
  vi.stubEnv('APPLE_TOKEN_ENCRYPTION_KEY_V1', Buffer.alloc(32, 17).toString('base64'));
  vi.stubEnv('PUBLIC_SITE_ORIGIN', 'https://cuberoot.me');
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ keys: [jwk] })));
  vi.stubGlobal('fetch', fetchMock);
  apple = await import('../src/utils/apple_login.js');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Apple configuration and OAuth callback', () => {
  it('uses fixed callback, signed state, OIDC nonce and minimal email scope', () => {
    expect(apple.appleConfigured()).toBe(true);
    const { url, state } = apple.appleAuthorize('login', codeChallenge);
    const parsed = new URL(url);
    expect(parsed.origin).toBe(appleIssuer);
    expect(parsed.searchParams.get('response_mode')).toBe('form_post');
    expect(parsed.searchParams.get('scope')).toBe('email');
    expect(parsed.searchParams.get('nonce')).toBe(state.split('.')[0]);
    expect(state.split('.')[0]).toHaveLength(43);
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://api.cuberoot.me/v1/auth/apple/callback');
    const callback = new URL(apple.appleCallbackUrl({ code: 'short-code', state, id_token: 'must-not-leak', user: 'must-not-leak' }));
    expect(callback.pathname).toBe('/auth/social/callback');
    expect([...callback.searchParams.keys()]).toEqual(['state', 'code']);
  });
  it.each(['APPLE_LOGIN_ENABLED', 'APPLE_CLIENT_ID', 'APPLE_PRIVATE_KEY', 'APPLE_TOKEN_ENCRYPTION_KEY_V1', 'JWT_SECRET'])('fails closed when %s missing', (name) => {
    vi.stubEnv(name, '');
    expect(apple.appleConfigured()).toBe(false);
    expect(() => apple.appleAuthorize('login', codeChallenge)).toThrow('not-configured');
  });
  it.each(['http://api.cuberoot.me/v1/auth/apple/callback', 'https://127.0.0.1/v1/auth/apple/callback', 'https://evil.test/elsewhere', 'https://api.cuberoot.me/v1/auth/apple/callback#fragment'])('rejects invalid redirect %s', (uri) => {
    vi.stubEnv('APPLE_REDIRECT_URI', uri);
    expect(apple.appleConfigured()).toBe(false);
  });
  it('rejects tampered or expired state and keeps cancellation bound to state', () => {
    const { state } = apple.appleAuthorize('link', codeChallenge, 42);
    expect(() => apple.appleCallbackUrl({ state: state.replace('.link.', '.login.'), code: 'code' })).toThrow('invalid-credential');
    expect(new URL(apple.appleCallbackUrl({ state, error: 'user_cancelled_authorize' })).searchParams.get('error')).toBe('user_cancelled_authorize');
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 601_000);
    expect(() => apple.appleCallbackUrl({ state, code: 'code' })).toThrow('invalid-credential');
  });
});

describe('Apple identity verification', () => {
  it('verifies a real RSA signature and uses sub rather than email for identity', async () => {
    expect(await apple.verifyAppleIdentityToken(identityToken('nonce', { email: 'relay@privaterelay.appleid.com' }), 'nonce', clientId)).toEqual({ sub: 'test-apple-sub' });
    expect(fetchMock.mock.calls[0][0]).toBe(`${appleIssuer}/auth/keys`);
  });
  it.each([
    { iss: 'https://evil.test' }, { aud: 'other-client' }, { aud: [clientId, 'other-client'] },
    { exp: 1 }, { exp: undefined }, { nonce: 'wrong' }, { sub: '' },
    { iat: Math.floor(Date.now() / 1000) + 3600 },
  ])('rejects invalid claims %j', async (claims) => {
    await expect(apple.verifyAppleIdentityToken(identityToken('nonce', claims), 'nonce', clientId)).rejects.toThrow();
  });
  it('rejects algorithm confusion and tampered signatures', async () => {
    const hs = jwt.sign({ sub: 'attacker' }, 'attacker-key', { algorithm: 'HS256' });
    await expect(apple.verifyAppleIdentityToken(hs, 'nonce', clientId)).rejects.toThrow('invalid-credential');
    const valid = identityToken('nonce');
    const [header, payload, signature] = valid.split('.');
    const tampered = `${header}.${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
    await expect(apple.verifyAppleIdentityToken(tampered, 'nonce', clientId)).rejects.toThrow('invalid-credential');
  });
  it('refreshes rotating keys without letting unknown kids trigger unbounded key fetches', async () => {
    vi.useFakeTimers();
    await apple.verifyAppleIdentityToken(identityToken('nonce'), 'nonce', clientId);
    const nextKid = 'rotated-apple-key';
    const rotated = jwt.sign({ sub: 'test-apple-sub', iss: appleIssuer, aud: clientId,
      exp: Math.floor(Date.now() / 1000) + 300, nonce: 'nonce' }, rsa.privateKey,
    { algorithm: 'RS256', keyid: nextKid });
    await expect(apple.verifyAppleIdentityToken(rotated, 'nonce', clientId)).rejects.toThrow('invalid-credential');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 61_000);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ keys: [{ ...jwk, kid: nextKid }] })));
    expect(await apple.verifyAppleIdentityToken(rotated, 'nonce', clientId)).toEqual({ sub: 'test-apple-sub' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('Apple code exchange and revocation', () => {
  async function exchange() {
    const { state } = apple.appleAuthorize('login', codeChallenge);
    fetchMock.mockImplementation(async (url: string) => new Response(JSON.stringify(url.endsWith('/keys')
      ? { keys: [jwk] }
      : { id_token: identityToken(state.split('.')[0]), refresh_token: 'test-refresh-credential' })));
    return apple.exchangeAppleCode('short-lived-code', state, 'login', codeVerifier);
  }
  it('exchanges code with ES256 client assertion then retains only encrypted revocation data', async () => {
    const identity = await exchange();
    expect(identity.sub).toBe('test-apple-sub');
    expect(identity.keyVersion).toBe(1);
    expect(identity.encryptedToken.includes(Buffer.from('test-refresh-credential'))).toBe(false);
    const init = fetchMock.mock.calls[0][1];
    expect(init.body.get('grant_type')).toBe('authorization_code');
    expect(init.body.get('redirect_uri')).toBe('https://api.cuberoot.me/v1/auth/apple/callback');
    const secret = jwt.verify(init.body.get('client_secret'), ec.publicKey, { algorithms: ['ES256'], issuer: 'TESTTEAM01', audience: appleIssuer, subject: clientId });
    expect(typeof secret).toBe('object');
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    // Disabling new logins must not prevent existing users deleting their accounts.
    vi.stubEnv('APPLE_LOGIN_ENABLED', '0');
    await apple.revokeAppleIdentities([{ provider: 'apple', provider_uid: identity.sub,
      apple_refresh_token_encrypted: identity.encryptedToken, apple_token_key_version: identity.keyVersion }]);
    expect(fetchMock.mock.lastCall?.[0]).toBe(`${appleIssuer}/auth/revoke`);
    expect(fetchMock.mock.lastCall?.[1].body.get('token_type_hint')).toBe('refresh_token');
  });
  it('rejects wrong intent before exchanging and rejects token transplant', async () => {
    const { state } = apple.appleAuthorize('link', codeChallenge, 42);
    await expect(apple.exchangeAppleCode('code', state, 'login', codeVerifier)).rejects.toThrow('invalid-credential');
    expect(fetchMock).not.toHaveBeenCalled();
    const identity = await exchange();
    await expect(apple.revokeAppleIdentities([{ provider: 'apple', provider_uid: 'another-user',
      apple_refresh_token_encrypted: identity.encryptedToken, apple_token_key_version: 1 }])).rejects.toThrow('unavailable');
  });
  it('does not exchange leaked callback code/state without the initiating browser verifier', async () => {
    const { state } = apple.appleAuthorize('login', codeChallenge);
    await expect(apple.exchangeAppleCode('code', state, 'login', Buffer.alloc(32, 24).toString('base64url'))).rejects.toThrow('invalid-credential');
    await expect(apple.exchangeAppleCode('code', state, 'login', '')).rejects.toThrow('invalid-credential');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('binds link authorization to the authenticated initiating account', async () => {
    expect(() => apple.appleAuthorize('link', codeChallenge)).toThrow('invalid-credential');
    const { state } = apple.appleAuthorize('link', codeChallenge, 42);
    expect(state.split('.')[0]).toBe(`${codeChallenge}~42`);
    await expect(apple.exchangeAppleCode('code', state, 'link', codeVerifier, 99)).rejects.toThrow('invalid-credential');
    await expect(apple.exchangeAppleCode('code', state, 'link', codeVerifier)).rejects.toThrow('invalid-credential');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('fails closed on missing revocation token and Apple outage', async () => {
    await expect(apple.revokeAppleIdentities([{ provider: 'apple', provider_uid: 'missing' }])).rejects.toThrow('unavailable');
    const identity = await exchange();
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    await expect(apple.revokeAppleIdentities([{ provider: 'apple', provider_uid: identity.sub,
      apple_refresh_token_encrypted: identity.encryptedToken, apple_token_key_version: 1 }])).rejects.toThrow('unavailable');
  });
});
