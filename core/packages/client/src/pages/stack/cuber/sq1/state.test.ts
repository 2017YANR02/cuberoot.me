import { describe, it, expect } from 'vitest';
import {
  solvedSq1,
  applySq1Move,
  applySq1Scramble,
  parseSq1Scramble,
  SOLVED_PIECES,
} from './sq1State';

describe('SQ1 state', () => {
  it('solved state has 24 slots matching SOLVED_PIECES', () => {
    const s = solvedSq1();
    expect(s.pieces).toEqual(SOLVED_PIECES);
    expect(s.sliceSolved).toBe(true);
  });

  it('identity turn (0,0) leaves state unchanged', () => {
    const s = applySq1Move(solvedSq1(), { kind: 'turn', top: 0, bot: 0 });
    expect(s.pieces).toEqual(SOLVED_PIECES);
  });

  it('slice toggles sliceSolved flag', () => {
    const s1 = applySq1Move(solvedSq1(), { kind: 'slice' });
    expect(s1.sliceSolved).toBe(false);
    const s2 = applySq1Move(s1, { kind: 'slice' });
    expect(s2.sliceSolved).toBe(true);
  });

  it('two slices return to solved (state is involution)', () => {
    const s = applySq1Scramble('//');
    expect(s.pieces).toEqual(SOLVED_PIECES);
    expect(s.sliceSolved).toBe(true);
  });

  it('U12 turn cycles back to identity', () => {
    let s = solvedSq1();
    for (let i = 0; i < 12; i++) {
      s = applySq1Move(s, { kind: 'turn', top: 1, bot: 0 });
    }
    expect(s.pieces).toEqual(SOLVED_PIECES);
  });

  it('D12 turn cycles back to identity', () => {
    let s = solvedSq1();
    for (let i = 0; i < 12; i++) {
      s = applySq1Move(s, { kind: 'turn', top: 0, bot: 1 });
    }
    expect(s.pieces).toEqual(SOLVED_PIECES);
  });

  it('parseSq1Scramble handles canonical form', () => {
    const moves = parseSq1Scramble('(1, 0) / (3, -3) /');
    expect(moves).toEqual([
      { kind: 'turn', top: 1, bot: 0 },
      { kind: 'slice' },
      { kind: 'turn', top: 3, bot: -3 },
      { kind: 'slice' },
    ]);
  });

  it('parseSq1Scramble handles space-separated form', () => {
    expect(parseSq1Scramble('1,0 / 3,-3 /')).toEqual([
      { kind: 'turn', top: 1, bot: 0 },
      { kind: 'slice' },
      { kind: 'turn', top: 3, bot: -3 },
      { kind: 'slice' },
    ]);
  });

  it('long random scramble parses to N moves', () => {
    const moves = parseSq1Scramble('(1,0)/(3,-3)/(0,3)/(-1,4)/(1,-2)/');
    expect(moves.length).toBe(10); // 5 turns + 5 slices
    expect(moves.filter(m => m.kind === 'slice').length).toBe(5);
  });

  it('full WCA-spec scramble does not throw / preserves 24 slots', () => {
    const s = applySq1Scramble('(1, 0) / (3, -3) / (0, 3) / (-2, -2) / (4, 1) /');
    expect(s.pieces.length).toBe(24);
    expect(new Set(s.pieces).size).toBeGreaterThan(8);
  });

  it('scramble followed by its inverse returns to solved', () => {
    const before = applySq1Scramble('(1, 0) / (3, -3) /');
    const after = applySq1Scramble('(1, 0) / (3, -3) / / (-3, 3) / (-1, 0)');
    expect(after.pieces).toEqual(SOLVED_PIECES);
    expect(after.sliceSolved).toBe(true);
    expect(before.pieces).not.toEqual(SOLVED_PIECES);
  });

  it('every (t, b) followed by (-t, -b) returns to solved', () => {
    for (const [t, b] of [[1, 0], [3, -3], [-2, -2], [4, 1], [0, -5], [-4, -4]] as const) {
      let s = solvedSq1();
      s = applySq1Move(s, { kind: 'turn', top: t, bot: b });
      s = applySq1Move(s, { kind: 'turn', top: -t, bot: -b });
      expect(s.pieces).toEqual(SOLVED_PIECES);
      expect(s.sliceSolved).toBe(true);
    }
  });

  it("several WCA scrambles + each one's inverse return to solved", () => {
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
    const top = s.pieces.slice(0, 12);
    const bot = s.pieces.slice(12, 24);
    expect(new Set(top)).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(new Set(bot)).toEqual(new Set([8, 9, 10, 11, 12, 13, 14, 15]));
  });

  it('after one slice, each layer still has 12 entries (mixed top/bot pieces)', () => {
    const s = applySq1Scramble('/');
    expect(s.pieces.length).toBe(24);
    const top = s.pieces.slice(0, 12);
    const hasBottomPieceInTop = top.some(p => p >= 8);
    expect(hasBottomPieceInTop).toBe(true);
  });

  // Shared tokenizer with pages/gen/sq1_svg.ts — locks single-num shorthand
  // and edge forms so the StackPage 打乱/解法 inputs accept them too.
  it('single-number shorthand `/3/` = `/ (3, 0) /`', () => {
    expect(parseSq1Scramble('/3/')).toEqual([
      { kind: 'slice' },
      { kind: 'turn', top: 3, bot: 0 },
      { kind: 'slice' },
    ]);
  });
  it('leading `3/` (no opening slash) parses', () => {
    expect(parseSq1Scramble('3/')).toEqual([
      { kind: 'turn', top: 3, bot: 0 },
      { kind: 'slice' },
    ]);
  });
  it('negative single `-3` = (-3, 0)', () => {
    expect(parseSq1Scramble('-3')).toEqual([
      { kind: 'turn', top: -3, bot: 0 },
    ]);
  });
  it('paren shorthand `(3)` = (3, 0)', () => {
    expect(parseSq1Scramble('(3)')).toEqual([
      { kind: 'turn', top: 3, bot: 0 },
    ]);
  });
  it('mixed shorthand + pair: `(1,0) / 3 / (-2, -2)`', () => {
    expect(parseSq1Scramble('(1,0) / 3 / (-2, -2)')).toEqual([
      { kind: 'turn', top: 1, bot: 0 },
      { kind: 'slice' },
      { kind: 'turn', top: 3, bot: 0 },
      { kind: 'slice' },
      { kind: 'turn', top: -2, bot: -2 },
    ]);
  });
  it('`30` stays pair `(3, 0)`, NOT single 30 (greedy backtrack)', () => {
    expect(parseSq1Scramble('30')).toEqual([
      { kind: 'turn', top: 3, bot: 0 },
    ]);
  });
});
