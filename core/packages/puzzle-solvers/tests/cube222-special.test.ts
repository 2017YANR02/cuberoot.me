import { describe, expect, it } from 'vitest';
import {
  CUBE222_STATE_TYPES,
  cube222StateTypeMatchesScramble,
  generate222SpecialScramble,
} from '../src/cube222';

function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOKENS = /^[URF](?:2|')?$/;

describe('shared 2x2 special scramble provider', () => {
  it('generates every state family through the canonical classifier', () => {
    const rng = seededRng(0x2225a7e);
    for (const type of CUBE222_STATE_TYPES) {
      for (let draw = 0; draw < 4; draw++) {
        const scramble = generate222SpecialScramble(type, rng);
        const tokens = scramble.split(/\s+/);
        expect(tokens.length, `${type}: ${scramble}`).toBeGreaterThanOrEqual(9);
        expect(tokens.length, `${type}: ${scramble}`).toBeLessThanOrEqual(11);
        expect(tokens.every((token) => TOKENS.test(token)), `${type}: ${scramble}`).toBe(true);
        expect(
          cube222StateTypeMatchesScramble(scramble, type),
          `${type} classifier rejected ${scramble}`,
        ).toBe(true);
      }
    }
  }, 30_000);

  it('keeps the csTimer 2223 contract: 25 U/R/F turns without adjacent faces', () => {
    const rng = seededRng(0x2223);
    for (let draw = 0; draw < 20; draw++) {
      const tokens = generate222SpecialScramble('3gen', rng).split(/\s+/);
      expect(tokens).toHaveLength(25);
      expect(tokens.every((token) => TOKENS.test(token))).toBe(true);
      for (let i = 1; i < tokens.length; i++) {
        expect(tokens[i][0], tokens.join(' ')).not.toBe(tokens[i - 1][0]);
      }
    }
  });

  it('fails explicitly instead of returning a wrong-family fallback', () => {
    // A zero draw budget exercises the failure contract deterministically. A
    // host may retry later; it must never receive an unrelated full-state row.
    expect(() => generate222SpecialScramble('cll', seededRng(1), 0))
      .toThrow('unable to sample 2x2 state family: cll');
  });
});
