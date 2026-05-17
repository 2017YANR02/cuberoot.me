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
});
