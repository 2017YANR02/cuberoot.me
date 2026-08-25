import { describe, expect, it } from 'vitest';
import {
  formatRoomCode,
  generateRoomCode,
  pickAvailableRoomCode,
  ROOM_CODE_RE,
} from '../src/utils/room_code.js';

describe('four-digit numeric room codes', () => {
  it('formats both boundaries and preserves leading zeros', () => {
    expect(formatRoomCode(0)).toBe('0000');
    expect(formatRoomCode(7)).toBe('0007');
    expect(formatRoomCode(9999)).toBe('9999');
  });

  it('rejects values outside the exact four-digit space', () => {
    for (const value of [-1, 1.5, 10_000, Number.NaN]) {
      expect(() => formatRoomCode(value)).toThrow(RangeError);
    }
  });

  it('generates only four decimal digits', () => {
    for (let i = 0; i < 500; i++) expect(generateRoomCode()).toMatch(ROOM_CODE_RE);
  });

  it('skips occupied and malformed draws deterministically', () => {
    const draws = ['1234', 'ABCD', '1234', '0007'];
    const code = pickAvailableRoomCode(new Set(['1234']), () => draws.shift()!, draws.length);
    expect(code).toBe('0007');
  });

  it('returns null when all 10,000 codes are occupied', () => {
    const occupied = new Set(Array.from({ length: 10_000 }, (_, i) => formatRoomCode(i)));
    expect(pickAvailableRoomCode(occupied)).toBeNull();
  });
});
