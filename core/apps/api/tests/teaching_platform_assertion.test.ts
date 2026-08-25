import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  TEACHING_PLATFORM_ASSERTION_AUDIENCE,
  TEACHING_PLATFORM_ASSERTION_ISSUER,
  type TeachingPlatformAssertionV1,
} from '@cuberoot/shared/teaching';
import {
  InvalidTeachingPlatformAssertionError,
  verifyTeachingPlatformAssertion,
} from '../src/utils/teaching_platform_assertion.js';

const SECRET = 'test-only-platform-bridge-secret-32-bytes';
const NOW = 1_800_000_000;
const BODY = new TextEncoder().encode('{"name":"测试机构"}');

function payload(overrides: Partial<TeachingPlatformAssertionV1> = {}): TeachingPlatformAssertionV1 {
  return {
    v: 1,
    iss: TEACHING_PLATFORM_ASSERTION_ISSUER,
    aud: TEACHING_PLATFORM_ASSERTION_AUDIENCE,
    sub: 'platform-user-42',
    phone: '138 0013 8000',
    name: '测试老师',
    method: 'POST',
    path: '/teaching/organizations',
    bodySha256: createHash('sha256').update(BODY).digest('hex'),
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    iat: NOW - 5,
    exp: NOW + 60,
    jti: 'assertion_nonce_1234567890',
    ...overrides,
  };
}

function sign(value: TeachingPlatformAssertionV1, secret = SECRET): string {
  const encoded = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encoded}.${createHmac('sha256', secret).update(encoded).digest('base64url')}`;
}

function verify(token: string, overrides: Partial<{
  method: string;
  path: string;
  body: Uint8Array;
  idempotencyKey: string | null;
}> = {}) {
  return verifyTeachingPlatformAssertion(token, SECRET, {
    method: 'POST',
    path: '/teaching/organizations',
    body: BODY,
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    ...overrides,
  }, NOW);
}

describe('teaching platform assertions', () => {
  it('accepts a signed, short-lived assertion bound to the exact request', () => {
    const result = verify(sign(payload()));

    expect(result.sub).toBe('platform-user-42');
    expect(result.phone).toBe('+8613800138000');
  });

  it('rejects signature tampering and weak shared secrets', () => {
    const token = sign(payload());
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;

    expect(() => verify(tampered)).toThrow(InvalidTeachingPlatformAssertionError);
    expect(() => verifyTeachingPlatformAssertion(token, 'too-short', {
      method: 'POST', path: '/teaching/organizations', body: BODY,
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    }, NOW)).toThrow(InvalidTeachingPlatformAssertionError);
  });

  it.each([
    ['method', { method: 'GET' }],
    ['path', { path: '/teaching/organizations/other' }],
    ['query', { path: '/teaching/organizations?include=members' }],
    ['body', { body: new TextEncoder().encode('{}') }],
    ['idempotency key', { idempotencyKey: '22222222-2222-4222-8222-222222222222' }],
  ])('rejects a mismatched %s binding', (_label, request) => {
    expect(() => verify(sign(payload()), request)).toThrow(InvalidTeachingPlatformAssertionError);
  });

  it('rejects expired and overlong assertions', () => {
    expect(() => verify(sign(payload({ iat: NOW - 200, exp: NOW - 100 })))).toThrow(InvalidTeachingPlatformAssertionError);
    expect(() => verify(sign(payload({ iat: NOW, exp: NOW + 91 })))).toThrow(InvalidTeachingPlatformAssertionError);
  });
});
