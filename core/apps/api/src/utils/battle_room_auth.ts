import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Opaque public handle. Crypto randomness plus an atomic DB collision guard prevents takeover. */
export function generateBattlePlayerId(): string {
  return randomBytes(5).toString('hex');
}

/** One-time player capability returned only by create/join. */
export function generateBattlePlayerToken(): string {
  return randomBytes(32).toString('base64url');
}

/** The database stores only this irreversible digest, never the bearer token. */
export function hashBattlePlayerToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function validBattlePlayerToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{40,128}$/.test(value);
}

export function battlePlayerTokenMatchesHash(token: unknown, expectedHash: unknown): boolean {
  if (!validBattlePlayerToken(token) || typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) {
    return false;
  }
  const actual = Buffer.from(hashBattlePlayerToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function battlePlayerTokenMatches(
  auth: Record<string, string> | undefined,
  playerId: string,
  token: unknown,
): boolean {
  return battlePlayerTokenMatchesHash(token, auth?.[playerId]);
}
