import { describe, expect, it } from 'vitest';

import {
  isSafeWebSessionDestination,
  isWebSessionTicket,
} from '../src/lib/web-session-contract';

describe('mini program web session contract', () => {
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
