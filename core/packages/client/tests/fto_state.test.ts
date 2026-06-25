import { describe, it, expect } from 'vitest';
import {
  FACE_TOKEN, FACE_PG, FACE_NORMAL,
  parseFtoMoves, ftoMoveToString, ftoMovesToString, invertFtoMoves,
  reduceFtoAlg, randomFtoScramble, type FtoMove,
} from '@/app/[lang]/sim/engine/fto/ftoState';

describe('FTO notation', () => {
  it('has 8 faces with unit normals + aligned token/PG-name arrays', () => {
    expect(FACE_TOKEN).toHaveLength(8);
    expect(FACE_PG).toHaveLength(8);
    expect(FACE_NORMAL).toHaveLength(8);
    for (const n of FACE_NORMAL) expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 9);
    // U up (+Y), D down (−Y) — cubing.js orientation.
    expect(FACE_NORMAL[FACE_TOKEN.indexOf('U' as never)]).toEqual([0, 1, 0]);
    expect(FACE_NORMAL[FACE_TOKEN.indexOf('D' as never)]).toEqual([0, -1, 0]);
    // back face token 'B' maps to PG name 'BB'.
    expect(FACE_PG[FACE_TOKEN.indexOf('B' as never)]).toBe('BB');
  });

  it('parse ↔ toString round-trips (bare = clockwise dir −1, primed = dir +1)', () => {
    expect(parseFtoMoves('U')).toEqual([{ face: 0, dir: -1 }]);
    expect(parseFtoMoves("U'")).toEqual([{ face: 0, dir: 1 }]);
    expect(ftoMoveToString({ face: 0, dir: -1 })).toBe('U');
    expect(ftoMoveToString({ face: 0, dir: 1 })).toBe("U'");
    // BL / BR match before single letters.
    expect(parseFtoMoves('BL BR B')).toEqual([
      { face: 5, dir: -1 }, { face: 6, dir: -1 }, { face: 4, dir: -1 },
    ]);
    for (let t = 0; t < 50; t++) {
      const scr = randomFtoScramble(30);
      expect(parseFtoMoves(ftoMovesToString(scr))).toEqual(scr);
    }
  });

  it('skips unknown tokens', () => {
    expect(parseFtoMoves('U garbage 9 BR')).toEqual([{ face: 0, dir: -1 }, { face: 6, dir: -1 }]);
  });

  it('reduce collapses same-face runs mod 3', () => {
    expect(reduceFtoAlg('U U U')).toBe('');
    expect(reduceFtoAlg('U U')).toBe("U'");   // −240° ≡ +120°
    expect(reduceFtoAlg("U' U'")).toBe('U');  // +240° ≡ −120°
    expect(reduceFtoAlg("U U'")).toBe('');
    expect(reduceFtoAlg('U BR')).toBe('U BR');
  });

  it('invert reverses order and flips direction', () => {
    const scr = parseFtoMoves("U BR' L");
    expect(ftoMovesToString(invertFtoMoves(scr))).toBe("L' BR U'");
  });

  it('random scramble: 30 turns, never the same face twice in a row', () => {
    const scr: FtoMove[] = randomFtoScramble(30);
    expect(scr).toHaveLength(30);
    for (let i = 1; i < scr.length; i++) expect(scr[i].face).not.toBe(scr[i - 1].face);
  });
});
