// Per-event scramble move-count tokenizer. Fixtures are real WCA scramble
// strings (WC2023 via the public API) so the counts lock the notation quirks:
// sq1 twist pairs, megaminx's 7 newline lines, clock pins, big-cube wide moves,
// and multi-blind packing one 3x3 per line.
//
// Goes through the shared subpath ('node' → dist), so CI builds @cuberoot/shared
// before the test runs (same as skewb-notation.test.ts).
import { describe, it, expect } from 'vitest';
import { scrambleMoveLengths, scrambleLengthUnit, scrambleMoveSamples } from '@cuberoot/shared/scramble-length';

const len1 = (e: string, s: string) => {
  const a = scrambleMoveLengths(e, s);
  expect(a).toHaveLength(1);
  return a[0];
};
const slash1 = (s: string) => {
  const a = scrambleMoveSamples('sq1', s);
  expect(a).toHaveLength(1);
  return a[0].qtm;
};

describe('scrambleMoveLengths', () => {
  it('333: whitespace tokens', () => {
    expect(len1('333', "U2 B2 U2 F L' U2 B L2 U B' R2 L2 D2 F R2 L2 F L'")).toBe(18);
  });

  it('skewb: whitespace tokens', () => {
    expect(len1('skewb', "B R L B L U' B' U' B' L U")).toBe(11);
  });

  it('sq1: WCA 12c4 = (x,y) twists + slashes (12 pairs + 11 slashes = 23)', () => {
    const s = '(-2,3) / (-3,0) / (0,3) / (5,-1) / (1,0) / (6,-3) / (-5,-4) / (2,0) / (0,-2) / (-2,-3) / (-1,0) / (1,-3)';
    expect(len1('sq1', s)).toBe(23);
    expect(slash1(s)).toBe(11); // slash-only metric (jaapsch twist)
  });

  it('sq1: trailing slash is a real slice — counts under WCA but not as a pair (12 + 12 = 24)', () => {
    const s = '(6,2) / (-2,-2) / (-3,0) / (3,0) / (2,-4) / (0,-2) / (3,0) / (1,-4) / (-2,-4) / (-2,0) / (0,-2) / (-2,-3) /';
    expect(len1('sq1', s)).toBe(24);
    expect(slash1(s)).toBe(12);
  });

  it('clock: pins + y2 + ALL each count as one token', () => {
    expect(len1('clock', 'UR5+ DR6+ DL4- UL0+ U2- R2- D0+ L6+ ALL1+ y2 U3+ R5- D6+ L0+ ALL1- DL')).toBe(16);
  });

  it('megaminx: 7 newline lines collapse into one whitespace count (77)', () => {
    const minx = [
      "R++ D-- R-- D-- R++ D-- R-- D-- R++ D-- U'",
      'R-- D++ R-- D++ R-- D++ R-- D-- R++ D++ U',
      'R-- D++ R-- D-- R-- D++ R-- D++ R++ D++ U',
      'R-- D-- R++ D-- R-- D++ R-- D++ R-- D++ U',
      "R++ D-- R++ D++ R++ D++ R-- D++ R++ D-- U'",
      "R++ D-- R-- D-- R-- D++ R-- D++ R++ D-- U'",
      'R++ D-- R-- D-- R-- D-- R++ D-- R-- D++ U',
    ].join('\n');
    expect(len1('minx', minx)).toBe(77);
  });

  it('megaminx: counts by move alphabet, robust to a glued move (missing space)', () => {
    // real WCA data quirk: "R--D--" with a missing space — still 11 moves on that line → 77
    const line7glued = "R-- D++ R++ D-- R++ D-- R--D-- R-- D++ U";
    const minx = Array(6).fill("R++ D-- R-- D-- R++ D-- R-- D-- R++ D-- U'").concat(line7glued).join('\n');
    expect(len1('minx', minx)).toBe(77);
  });

  it('444: single value, wide moves counted as tokens', () => {
    const s = "L' U2 F B' D' U2 L2 F' R' U L2 R' F2 D2 R' B2 U2 F2 U2 Rw2 Fw2 L D2 L F' Uw2 L' U2 R' B2 U B' Rw2 L B2 Uw' Fw Uw' Fw L' Uw R' U2";
    expect(len1('444', s)).toBe(43);
  });

  it('multi-blind: one 3x3 length per line', () => {
    const l1 = "U L2 D R2 U2 B2 D2 B2 L2 F R2 D L' F L R2 F2 R' U' Rw";   // 20
    const l2 = "U B2 D' B' U2 R' D2 B2 L2 D' L2 F2 D' R2 B' R F' L2";       // 18
    expect(scrambleMoveLengths('333mbf', `${l1}\n${l2}`)).toEqual([20, 18]);
    expect(scrambleMoveLengths('333mbo', `${l1}\n${l2}`)).toEqual([20, 18]);
  });

  it('blank / whitespace-only → no samples', () => {
    expect(scrambleMoveLengths('magic', '')).toEqual([]);
    expect(scrambleMoveLengths('333', '   ')).toEqual([]);
    expect(scrambleMoveLengths('sq1', '')).toEqual([]);
  });
});

describe('scrambleLengthUnit', () => {
  it('sq1 is twists, everything else moves', () => {
    expect(scrambleLengthUnit('sq1')).toBe('twists');
    expect(scrambleLengthUnit('333')).toBe('moves');
    expect(scrambleLengthUnit('444')).toBe('moves');
    expect(scrambleLengthUnit('minx')).toBe('moves');
  });
});
