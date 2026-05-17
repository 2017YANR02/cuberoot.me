import { describe, it, expect } from 'vitest';
import {
  solvedSq1,
  applySq1Move,
  applySq1Scramble,
  parseSq1Scramble,
  SOLVED_PIECES,
  pieceColors,
  DEFAULT_SQ1_COLORS,
  SQ1_FACE_KEYS,
} from './state';

describe('SQ1 state', () => {
  it('solved state has 24 slots matching SOLVED_PIECES', () => {
    const s = solvedSq1();
    expect(s.pieces).toEqual(SOLVED_PIECES);
    expect(s.sliceSolved).toBe(true);
  });

  it('identity turn (0,0) leaves state unchanged', () => {
    const s = applySq1Move(solvedSq1(), { kind: 'turn', top: 0, bottom: 0 });
    expect(s.pieces).toEqual(SOLVED_PIECES);
  });

  it('slash toggles sliceSolved flag', () => {
    const s1 = applySq1Move(solvedSq1(), { kind: 'slash' });
    expect(s1.sliceSolved).toBe(false);
    const s2 = applySq1Move(s1, { kind: 'slash' });
    expect(s2.sliceSolved).toBe(true);
  });

  it('two slashes return to solved (state is involution)', () => {
    const s = applySq1Scramble('//');
    expect(s.pieces).toEqual(SOLVED_PIECES);
    expect(s.sliceSolved).toBe(true);
  });

  it('U12 turn cycles back to identity', () => {
    let s = solvedSq1();
    for (let i = 0; i < 12; i++) {
      s = applySq1Move(s, { kind: 'turn', top: 1, bottom: 0 });
    }
    expect(s.pieces).toEqual(SOLVED_PIECES);
  });

  it('D12 turn cycles back to identity', () => {
    let s = solvedSq1();
    for (let i = 0; i < 12; i++) {
      s = applySq1Move(s, { kind: 'turn', top: 0, bottom: 1 });
    }
    expect(s.pieces).toEqual(SOLVED_PIECES);
  });

  it('parseSq1Scramble handles canonical form', () => {
    const moves = parseSq1Scramble('(1, 0) / (3, -3) /');
    expect(moves).toEqual([
      { kind: 'turn', top: 1, bottom: 0 },
      { kind: 'slash' },
      { kind: 'turn', top: 3, bottom: -3 },
      { kind: 'slash' },
    ]);
  });

  it('parseSq1Scramble handles space-separated form', () => {
    expect(parseSq1Scramble('1,0 / 3,-3 /')).toEqual([
      { kind: 'turn', top: 1, bottom: 0 },
      { kind: 'slash' },
      { kind: 'turn', top: 3, bottom: -3 },
      { kind: 'slash' },
    ]);
  });

  it('long random scramble parses to N moves', () => {
    const moves = parseSq1Scramble('(1,0)/(3,-3)/(0,3)/(-1,4)/(1,-2)/');
    expect(moves.length).toBe(10); // 5 turns + 5 slashes
    expect(moves.filter(m => m.kind === 'slash').length).toBe(5);
  });

  it('full WCA-spec scramble does not throw / preserves 24 slots', () => {
    const s = applySq1Scramble('(1, 0) / (3, -3) / (0, 3) / (-2, -2) / (4, 1) /');
    expect(s.pieces.length).toBe(24);
    expect(new Set(s.pieces).size).toBeGreaterThan(8); // many distinct pieces present
  });

  it('scramble followed by its inverse returns to solved', () => {
    // Inverse of `(1, 0) / (3, -3) /` is `/ (-3, 3) / (-1, 0)`
    // (reverse order, negate each (t,b), `/` is self-inverse).
    const before = applySq1Scramble('(1, 0) / (3, -3) /');
    const after = applySq1Scramble('(1, 0) / (3, -3) / / (-3, 3) / (-1, 0)');
    expect(after.pieces).toEqual(SOLVED_PIECES);
    expect(after.sliceSolved).toBe(true);
    expect(before.pieces).not.toEqual(SOLVED_PIECES);
  });

  it('pieceColors: corner gets [top, side, side]', () => {
    const scheme = SQ1_FACE_KEYS.map(k => DEFAULT_SQ1_COLORS[k]);
    const c = pieceColors(0, scheme); // top corner 0
    expect(c.top).toBe(DEFAULT_SQ1_COLORS.U);
    expect(c.sides.length).toBe(2);
  });

  it('pieceColors: edge gets [top, side]', () => {
    const scheme = SQ1_FACE_KEYS.map(k => DEFAULT_SQ1_COLORS[k]);
    const c = pieceColors(1, scheme); // top edge 1
    expect(c.top).toBe(DEFAULT_SQ1_COLORS.U);
    expect(c.sides.length).toBe(1);
  });

  it('pieceColors: bottom piece uses D face for top sticker', () => {
    const scheme = SQ1_FACE_KEYS.map(k => DEFAULT_SQ1_COLORS[k]);
    const c = pieceColors(9, scheme); // bottom corner
    expect(c.top).toBe(DEFAULT_SQ1_COLORS.D);
  });

  it('every (t, b) followed by (-t, -b) returns to solved', () => {
    for (const [t, b] of [[1, 0], [3, -3], [-2, -2], [4, 1], [0, -5], [-4, -4]] as const) {
      let s = solvedSq1();
      s = applySq1Move(s, { kind: 'turn', top: t, bottom: b });
      s = applySq1Move(s, { kind: 'turn', top: -t, bottom: -b });
      expect(s.pieces).toEqual(SOLVED_PIECES);
      expect(s.sliceSolved).toBe(true);
    }
  });

  it('several WCA scrambles + each one\'s inverse return to solved', () => {
    // Inverse: reverse move order, negate each (t, b), keep `/` as is.
    const invertAlg = (alg: string): string => {
      const re = /(\/)|\(?\s*(-?\d+)\s*,?\s*(-?\d+)\s*\)?/g;
      const tokens: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(alg)) !== null) {
        if (m[1] === '/') tokens.push('/');
        else tokens.push(`(${-parseInt(m[2]!, 10)},${-parseInt(m[3]!, 10)})`);
      }
      return tokens.reverse().join(' ');
    };
    for (const fwd of [
      '(1, 0) / (-2, -2) / (1, -2) / (0, -3) / (-4, 0)',
      '(3, 0) / (0, -3) / (1, 1) / (-1, -2) /',
      '(6, 0) / (0, 6) / (3, -3) /',
    ]) {
      const s = applySq1Scramble(fwd + ' ' + invertAlg(fwd));
      expect(s.pieces).toEqual(SOLVED_PIECES);
      expect(s.sliceSolved).toBe(true);
    }
  });

  it('slot indexing invariant: top has 12 + bottom 12 unique slot fillings', () => {
    const s = solvedSq1();
    // Each layer's 12 slot entries cover exactly piece ids 0..7 (top) or 8..15 (bottom).
    const top = s.pieces.slice(0, 12);
    const bot = s.pieces.slice(12, 24);
    expect(new Set(top)).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(new Set(bot)).toEqual(new Set([8, 9, 10, 11, 12, 13, 14, 15]));
  });

  it('after one slash, each layer still has 12 entries (mixed top/bot pieces)', () => {
    const s = applySq1Scramble('/');
    expect(s.pieces.length).toBe(24);
    // Right-half slots 6..11 (top) ↔ 12..17 (bottom) swap — so top now contains
    // some originally-bottom piece ids.
    const top = s.pieces.slice(0, 12);
    const hasBottomPieceInTop = top.some(p => p >= 8);
    expect(hasBottomPieceInTop).toBe(true);
  });

  it('pieceColors: all 4 top corners use exactly {F, L, B, R} sticker palette', () => {
    const scheme = SQ1_FACE_KEYS.map(k => DEFAULT_SQ1_COLORS[k]);
    const sideHexes = new Set<string>();
    for (const id of [0, 2, 4, 6]) {
      const c = pieceColors(id, scheme);
      for (const s of c.sides) sideHexes.add(s);
    }
    // Should cover all 4 side faces (L, B, R, F).
    expect(sideHexes).toEqual(new Set([
      DEFAULT_SQ1_COLORS.L,
      DEFAULT_SQ1_COLORS.B,
      DEFAULT_SQ1_COLORS.R,
      DEFAULT_SQ1_COLORS.F,
    ]));
  });

  it('pieceColors: each top corner has 2 distinct adjacent-face colors', () => {
    const scheme = SQ1_FACE_KEYS.map(k => DEFAULT_SQ1_COLORS[k]);
    // The two stickers on a single corner must NOT be opposite faces
    // (i.e. not {F,B} or {L,R}). Adjacent faces only.
    const opposites = new Map([
      [DEFAULT_SQ1_COLORS.F, DEFAULT_SQ1_COLORS.B],
      [DEFAULT_SQ1_COLORS.B, DEFAULT_SQ1_COLORS.F],
      [DEFAULT_SQ1_COLORS.L, DEFAULT_SQ1_COLORS.R],
      [DEFAULT_SQ1_COLORS.R, DEFAULT_SQ1_COLORS.L],
    ]);
    for (const id of [0, 2, 4, 6, 9, 11, 13, 15]) {
      const c = pieceColors(id, scheme);
      expect(c.sides.length).toBe(2);
      expect(c.sides[0]).not.toBe(c.sides[1]);
      expect(opposites.get(c.sides[0])).not.toBe(c.sides[1]);
    }
  });
});
