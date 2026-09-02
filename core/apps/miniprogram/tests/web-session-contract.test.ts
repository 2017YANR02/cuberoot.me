import { describe, expect, it } from 'vitest';

import {
  decodeMiniProgramSessionMessage,
  decodeWebSessionError,
  decodeWebSession,
  decodeWebSessionTicketEnvelope,
  decodeWebSessionUserEnvelope,
  isSafeWebSessionDestination,
  isWebSessionTicket,
} from '../src/lib/web-session-contract';

describe('mini program web session contract', () => {
  it('accepts only the canonical native session logout message', () => {
    expect(decodeMiniProgramSessionMessage({
      type: 'cuberoot:session',
      action: 'logout',
    })).toEqual({ type: 'cuberoot:session', action: 'logout' });
    expect(decodeMiniProgramSessionMessage({
      type: 'cuberoot:session',
      action: 'login',
    })).toBeNull();
    expect(decodeMiniProgramSessionMessage(null)).toBeNull();
  });

  it('accepts only the server base64url ticket shape', () => {
    expect(isWebSessionTicket('A'.repeat(43))).toBe(true);
    expect(isWebSessionTicket('aZ0_-'.repeat(9).slice(0, 43))).toBe(true);
    expect(isWebSessionTicket('A'.repeat(42))).toBe(false);
    expect(isWebSessionTicket('A'.repeat(44))).toBe(false);
    expect(isWebSessionTicket(`${'A'.repeat(42)}=`)).toBe(false);
    expect(isWebSessionTicket(`${'A'.repeat(42)}+`)).toBe(false);
    expect(isWebSessionTicket(`${'A'.repeat(42)}/`)).toBe(false);
    expect(isWebSessionTicket(null)).toBe(false);
  });

  it('decodes the canonical auth route envelopes, including an unnamed first-time WeChat user', () => {
    const user = { uid: 12, wcaId: null, name: '', avatar: '' };
    const normalizedUser = {
      ...user,
      avatarSource: 'auto',
      avatarPreset: null,
    };
    expect(decodeWebSessionUserEnvelope({ user })).toEqual({ user: normalizedUser });
    expect(decodeWebSession({ token: 't'.repeat(20), user, isNew: true })).toEqual({
      token: 't'.repeat(20),
      user: normalizedUser,
    });
    expect(decodeWebSessionTicketEnvelope({ ticket: 'A'.repeat(43), expiresIn: 90 })).toEqual({
      ticket: 'A'.repeat(43),
      expiresIn: 90,
    });
  });

  it('rejects incomplete or unsafe public session users', () => {
    const validUser = { uid: 12, wcaId: null, name: '', avatar: '' };
    expect(decodeWebSession({ token: 't'.repeat(20), user: validUser })).not.toBeNull();

    const invalidUsers = [
      { ...validUser, uid: 0 },
      { ...validUser, uid: Number.MAX_SAFE_INTEGER + 1 },
      { uid: 12, wcaId: null, name: '' },
      { ...validUser, wcaId: 'W'.repeat(21) },
      { ...validUser, wcaId: '2026\tROOT01' },
      { ...validUser, wcaId: '\t2026ROOT01' },
      { ...validUser, name: 'N'.repeat(201) },
      { ...validUser, name: 'Cube\nRoot' },
      { ...validUser, avatar: 'a'.repeat(2049) },
      { ...validUser, avatar: 'https://example.test/\ravatar' },
    ];
    for (const user of invalidUsers) {
      expect(decodeWebSession({ token: 't'.repeat(20), user })).toBeNull();
    }

    for (const token of [
      't'.repeat(19),
      't'.repeat(4097),
      `${'t'.repeat(20)}\nheader`,
      `\t${'t'.repeat(20)}`,
      ` ${'t'.repeat(20)}`,
      `${'t'.repeat(20)} `,
      `${'t'.repeat(20)}${' '.repeat(4077)}`,
    ]) {
      expect(decodeWebSession({ token, user: validUser })).toBeNull();
    }
  });

  it('rejects malformed ticket envelopes and expiry values', () => {
    expect(decodeWebSessionTicketEnvelope({ ticket: 'A'.repeat(42), expiresIn: 90 })).toBeNull();
    expect(decodeWebSessionTicketEnvelope({ ticket: 'A'.repeat(43), expiresIn: 0 })).toBeNull();
    expect(decodeWebSessionTicketEnvelope({ ticket: 'A'.repeat(43), expiresIn: 1.5 })).toBeNull();
    expect(decodeWebSessionTicketEnvelope({
      ticket: 'A'.repeat(43),
      expiresIn: Number.MAX_SAFE_INTEGER + 1,
    })).toBeNull();
  });

  it('accepts only canonical stable auth error envelopes', () => {
    const error = {
      code: 'INVALID_WECHAT_CODE',
      message: 'invalid wechat code',
      error: 'invalid wechat code',
    };
    expect(decodeWebSessionError(error)).toEqual(error);
    expect(decodeWebSessionError({ ...error, code: 'MESSAGE_CHANGED_LATER' })).toBeNull();
    expect(decodeWebSessionError({ ...error, error: 'legacy text drifted' })).toBeNull();
    expect(decodeWebSessionError({ ...error, message: 'unsafe\nmessage', error: 'unsafe\nmessage' })).toBeNull();
    expect(decodeWebSessionError({ code: error.code, error: error.error })).toBeNull();
  });

  it('accepts only same-site path destinations', () => {
    expect(isSafeWebSessionDestination('/')).toBe(true);
    expect(isSafeWebSessionDestination('/zh/timer?mode=333#history')).toBe(true);
    expect(isSafeWebSessionDestination('//evil.example')).toBe(false);
    expect(isSafeWebSessionDestination('/\\evil.example')).toBe(false);
    expect(isSafeWebSessionDestination('/zh/\ntimer')).toBe(false);
    expect(isSafeWebSessionDestination('https://cuberoot.me/zh/timer')).toBe(false);
    expect(isSafeWebSessionDestination(undefined)).toBe(false);
  });
});
