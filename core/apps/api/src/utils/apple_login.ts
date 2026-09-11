/** Sign in with Apple is an identity adapter, not a second account/session system.
 * Secrets stay server-side. Official protocol: https://developer.apple.com/documentation/signinwithapplerestapi
 */
import { createPrivateKey, createPublicKey, type JsonWebKey } from 'node:crypto';
import { isIP } from 'node:net';
import jwt from 'jsonwebtoken';
import { isMobileAuthCodeChallenge, isMobileAuthCodeVerifier } from '@cuberoot/shared/auth/web-session';
import { challengeFromVerifier } from './auth_pkce.js';
import { decryptPrivateData, encryptPrivateData, parsePrivateDataKey } from './private_data_encryption.js';
import { signSocialState, verifySocialState, type SocialIntent } from './social_login.js';

const ISSUER = 'https://appleid.apple.com';
const TOKEN_KEY_VERSION = 1;
const AAD = Buffer.from('cuberoot:auth:apple-token:v1');
const REQUEST_TIMEOUT_MS = 12000;

export class AppleLoginError extends Error {
  constructor(public readonly code: 'not-configured' | 'invalid-credential' | 'unavailable') {
    super(`Apple login ${code}`);
  }
}

function httpsUrl(raw: string, originOnly = false): string {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search
    || url.hostname === 'localhost' || isIP(url.hostname) !== 0 || !url.hostname.includes('.')
    || (originOnly && url.pathname !== '/')) throw new Error('Invalid Apple URL');
  return originOnly ? url.origin : url.href;
}

function appleConfig(requireEnabled = true) {
  try {
    if ((requireEnabled && !['1', 'true'].includes(process.env.APPLE_LOGIN_ENABLED ?? '')) || !process.env.JWT_SECRET) {
      throw new Error('Disabled');
    }
    const clientId = process.env.APPLE_CLIENT_ID?.trim() ?? '';
    const teamId = process.env.APPLE_TEAM_ID?.trim() ?? '';
    const keyId = process.env.APPLE_KEY_ID?.trim() ?? '';
    if (!/^[A-Za-z0-9.-]+$/.test(clientId) || !/^[A-Z0-9]{10}$/.test(teamId)
      || !/^[A-Z0-9]{10}$/.test(keyId)) throw new Error('Missing Apple configuration');
    const privateKey = createPrivateKey((process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'));
    if (privateKey.asymmetricKeyType !== 'ec' || privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
      throw new Error('Invalid Apple signing key');
    }
    const redirectUri = httpsUrl(process.env.APPLE_REDIRECT_URI ?? '');
    if (new URL(redirectUri).pathname !== '/v1/auth/apple/callback') throw new Error('Invalid Apple callback');
    const siteOrigin = httpsUrl(process.env.PUBLIC_SITE_ORIGIN || 'https://cuberoot.me', true);
    const tokenKey = parsePrivateDataKey(process.env.APPLE_TOKEN_ENCRYPTION_KEY_V1?.trim() ?? '');
    return { clientId, teamId, keyId, privateKey, redirectUri, siteOrigin, tokenKey };
  } catch {
    throw new AppleLoginError('not-configured');
  }
}

export function appleConfigured(): boolean {
  try { appleConfig(); return true; } catch { return false; }
}

export function appleAuthorize(intent: SocialIntent, codeChallenge: string, accountId?: number): { url: string; state: string; siteOrigin: string } {
  const config = appleConfig();
  if (!isMobileAuthCodeChallenge(codeChallenge)) throw new AppleLoginError('invalid-credential');
  if (intent === 'link' && (!Number.isSafeInteger(accountId) || (accountId ?? 0) <= 0)) {
    throw new AppleLoginError('invalid-credential');
  }
  const state = signSocialState('apple', intent, codeChallenge, accountId);
  const params = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code',
    response_mode: 'form_post', scope: 'email', state, nonce: state.split('.')[0],
  });
  // No name scope: a public CubeRoot display name remains the user's own profile choice.
  return { url: `${ISSUER}/auth/authorize?${params}`, state, siteOrigin: config.siteOrigin };
}

export function appleCallbackUrl(fields: Record<string, unknown>): string {
  const config = appleConfig();
  const state = fields.state;
  if (typeof state !== 'string' || state.length > 512 || !verifySocialState(state, 'apple')) {
    throw new AppleLoginError('invalid-credential');
  }
  const target = new URL('/auth/social/callback', config.siteOrigin);
  target.searchParams.set('state', state);
  if (typeof fields.error === 'string') {
    target.searchParams.set('error', fields.error === 'user_cancelled_authorize' ? fields.error : 'access_denied');
  } else if (typeof fields.code === 'string' && fields.code.length > 0 && fields.code.length <= 2048) {
    target.searchParams.set('code', fields.code);
  } else {
    throw new AppleLoginError('invalid-credential');
  }
  // Never relay id_token, user (unsigned first-login data), email, or provider tokens into a URL.
  return target.href;
}

function clientSecret(config: ReturnType<typeof appleConfig>): string {
  return jwt.sign({}, config.privateKey, {
    algorithm: 'ES256', keyid: config.keyId, issuer: config.teamId,
    audience: ISSUER, subject: config.clientId, expiresIn: 300,
  });
}

type AppleJwk = JsonWebKey & { kid: string; alg: string; use: string };
let keyCache: { fetchedAt: number; expiresAt: number; keys: AppleJwk[] } | null = null;
let keyFetch: Promise<AppleJwk[]> | null = null;

async function appleKeys(refresh = false): Promise<AppleJwk[]> {
  if (keyCache && keyCache.expiresAt > Date.now()
    && (!refresh || Date.now() - keyCache.fetchedAt < 60_000)) return keyCache.keys;
  if (keyFetch) return keyFetch;
  keyFetch = (async () => {
    const response = await fetch(`${ISSUER}/auth/keys`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), redirect: 'error' });
    if (!response.ok) throw new AppleLoginError('unavailable');
    const body = await response.json() as { keys?: AppleJwk[] };
    if (!Array.isArray(body.keys) || !body.keys.length || body.keys.length > 20) throw new AppleLoginError('unavailable');
    const keys = body.keys.filter((key) => key.kty === 'RSA' && key.alg === 'RS256' && key.use === 'sig'
      && typeof key.kid === 'string' && typeof key.n === 'string' && typeof key.e === 'string');
    keyCache = { keys, fetchedAt: Date.now(), expiresAt: Date.now() + 3600_000 };
    return keys;
  })();
  try { return await keyFetch; } finally { keyFetch = null; }
}

export async function verifyAppleIdentityToken(token: string, nonce: string, clientId: string): Promise<{ sub: string }> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || decoded.header.alg !== 'RS256' || typeof decoded.header.kid !== 'string') {
    throw new AppleLoginError('invalid-credential');
  }
  let key = (await appleKeys()).find((candidate) => candidate.kid === decoded.header.kid);
  if (!key) key = (await appleKeys(true)).find((candidate) => candidate.kid === decoded.header.kid);
  if (!key) throw new AppleLoginError('invalid-credential');
  try {
    const claims = jwt.verify(token, createPublicKey({ key, format: 'jwk' }), {
      algorithms: ['RS256'], issuer: ISSUER, audience: clientId,
    });
    if (typeof claims === 'string' || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 320
      || typeof claims.exp !== 'number' || typeof claims.iat !== 'number' || claims.iat > Date.now() / 1000 + 60
      || claims.nonce !== nonce || claims.aud !== clientId) throw new Error('Invalid Apple claims');
    // Identity is ONLY the signed sub. Never auto-link accounts by real or private-relay email.
    return { sub: claims.sub };
  } catch {
    throw new AppleLoginError('invalid-credential');
  }
}

export async function exchangeAppleCode(code: string, state: string, intent: SocialIntent, codeVerifier: string, accountId?: number): Promise<{
  sub: string; encryptedToken: Buffer; keyVersion: number;
}> {
  const config = appleConfig();
  const [codeChallenge, stateAccountId] = state.split('.')[0].split('~');
  if (!code || code.length > 2048 || state.length > 512 || verifySocialState(state, 'apple')?.intent !== intent
    || !isMobileAuthCodeVerifier(codeVerifier) || challengeFromVerifier(codeVerifier) !== codeChallenge
    || (intent === 'link' && (!Number.isSafeInteger(accountId) || stateAccountId !== String(accountId)))
    || (intent === 'login' && stateAccountId !== undefined)) {
    throw new AppleLoginError('invalid-credential');
  }
  const response = await fetch(`${ISSUER}/auth/token`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: clientSecret(config),
      code, grant_type: 'authorization_code', redirect_uri: config.redirectUri }),
  });
  if (!response.ok) throw new AppleLoginError(response.status >= 500 ? 'unavailable' : 'invalid-credential');
  const tokens = await response.json() as { id_token?: unknown; refresh_token?: unknown };
  if (typeof tokens.id_token !== 'string' || typeof tokens.refresh_token !== 'string'
    || !tokens.refresh_token || tokens.refresh_token.length > 8192) throw new AppleLoginError('invalid-credential');
  const identity = await verifyAppleIdentityToken(tokens.id_token, state.split('.')[0], config.clientId);
  return {
    sub: identity.sub,
    encryptedToken: encryptPrivateData({ sub: identity.sub, clientId: config.clientId, refreshToken: tokens.refresh_token }, config.tokenKey, AAD),
    keyVersion: TOKEN_KEY_VERSION,
  };
}

export interface AppleRevocationIdentity {
  provider: string;
  provider_uid: string;
  apple_refresh_token_encrypted?: Buffer | null;
  apple_token_key_version?: number | null;
}

/** Called under the existing account/identity transaction locks, after eligibility checks.
 * Apple failures abort the local unlink/delete so we retain the credential and can retry.
 */
export async function revokeAppleIdentities(identities: readonly AppleRevocationIdentity[]): Promise<void> {
  for (const identity of identities) {
    if (identity.provider !== 'apple') continue;
    const config = appleConfig(false);
    if (!identity.apple_refresh_token_encrypted || identity.apple_token_key_version !== TOKEN_KEY_VERSION) {
      throw new AppleLoginError('unavailable');
    }
    const data = decryptPrivateData(identity.apple_refresh_token_encrypted, config.tokenKey, AAD);
    if (data.sub !== identity.provider_uid || data.clientId !== config.clientId || typeof data.refreshToken !== 'string') {
      throw new AppleLoginError('unavailable');
    }
    const response = await fetch(`${ISSUER}/auth/revoke`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: clientSecret(config),
        token: data.refreshToken, token_type_hint: 'refresh_token' }),
    });
    if (!response.ok) throw new AppleLoginError('unavailable');
  }
}
