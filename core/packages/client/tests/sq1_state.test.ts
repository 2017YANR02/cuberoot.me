import { describe, it, expect } from 'vitest';
import {
  solvedSq1,
  applySq1Move,
  applySq1Scramble,
  parseSq1Scramble,
  isSlashValid,
  snapValidLayerTurn,
  SOLVED_PIECES,
} from '@/app/[lang]/sim/engine/sq1/sq1State';

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
  // and edge forms so the SimPage 打乱/解法 inputs accept them too.
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

  // ─── slash-validity (drag shape gating) ────────────────────────────────
  it('solved state is slash-valid', () => {
    expect(isSlashValid(solvedSq1())).toBe(true);
  });

  it('after (1,0) top is still slash-valid (corner-edge boundary on cuts)', () => {
    const s = applySq1Move(solvedSq1(), { kind: 'turn', top: 1, bot: 0 });
    expect(isSlashValid(s)).toBe(true);
  });

  it('after (-1,0) top has corners straddling both cuts — NOT slash-valid', () => {
    const s = applySq1Move(solvedSq1(), { kind: 'turn', top: -1, bot: 0 });
    expect(isSlashValid(s)).toBe(false);
  });

  it('after (2,0) top has corners straddling both cuts — NOT slash-valid', () => {
    const s = applySq1Move(solvedSq1(), { kind: 'turn', top: 2, bot: 0 });
    expect(isSlashValid(s)).toBe(false);
  });

  it('after (0,1) bot has corners straddling cuts — NOT slash-valid', () => {
    const s = applySq1Move(solvedSq1(), { kind: 'turn', top: 0, bot: 1 });
    expect(isSlashValid(s)).toBe(false);
  });

  it('snapValidLayerTurn: from solved, fractional drag into forbidden ±30° zone snaps to 0 (not 60°)', () => {
    const s = solvedSq1();
    // Forbidden top U on solved: {-4, -1, 2, 5} (within [-6, 6]).
    // Drag target -1.0 (-30°): valid candidates 0 (dist 1.0), 1 (dist 2.0), -2 (dist 1.0).
    // Tie-break prefers smaller |U| → 0 (snap back, mimics physical block).
    expect(snapValidLayerTurn(s, 'top', -1)).toBe(0);
    expect(snapValidLayerTurn(s, 'top', 2)).toBe(1);   // 2 invalid, nearest valid +1
    expect(snapValidLayerTurn(s, 'top', 2.6)).toBe(3); // 2.6 closer to 3 than 1
    expect(snapValidLayerTurn(s, 'top', 5)).toBe(4);   // 5 invalid, 4 closer than 6
  });

  it('snapValidLayerTurn: clean integer valid targets are returned unchanged', () => {
    const s = solvedSq1();
    for (const u of [0, 1, 3, 4, 6, -2, -3, -5, -6]) {
      expect(snapValidLayerTurn(s, 'top', u)).toBe(u);
    }
  });

  it('snapValidLayerTurn: bot forbidden set differs from top by corner offset', () => {
    const s = solvedSq1();
    // Forbidden bot U on solved: {-5, -2, 1, 4}.
    expect(snapValidLayerTurn(s, 'bot', 1)).toBe(0);   // 1 invalid → 0
    expect(snapValidLayerTurn(s, 'bot', 4)).toBe(3);   // 4 invalid → 3
    expect(snapValidLayerTurn(s, 'bot', 3)).toBe(3);
  });

  it('snapValidLayerTurn: from a scrambled but slash-valid state, snap chooses valid neighbor', () => {
    // Apply a real scramble that stays slash-valid at every step.
    const s = applySq1Scramble('(1,0) / (3,-3) / (0,3) /');
    expect(isSlashValid(s)).toBe(true);
    for (const layer of ['top', 'bot'] as const) {
      for (let target = -6; target <= 6; target += 0.25) {
        const u = snapValidLayerTurn(s, layer, target);
        const next = applySq1Move(
          s,
          layer === 'top' ? { kind: 'turn', top: u, bot: 0 } : { kind: 'turn', top: 0, bot: u },
        );
        expect(isSlashValid(next)).toBe(true);
      }
    }
  });

  it('snapValidLayerTurn fuzz: 200 random states → snap always lands slash-valid', () => {
    // Seedless but bounded: drive a state through random valid moves + slices,
    // then ask snap for random fractional targets and check the result.
    let state = solvedSq1();
    let trials = 0;
    for (let i = 0; i < 200; i++) {
      const layer = Math.random() < 0.5 ? 'top' : 'bot';
      const target = (Math.random() * 12 - 6);
      const u = snapValidLayerTurn(state, layer, target);
      const next = applySq1Move(
        state,
        layer === 'top' ? { kind: 'turn', top: u, bot: 0 } : { kind: 'turn', top: 0, bot: u },
      );
      expect(isSlashValid(next)).toBe(true);
      state = next;
      // 30% chance to slice (slash-valid → still slash-valid after slice).
      if (Math.random() < 0.3) {
        const sliced = applySq1Move(state, { kind: 'slice' });
        if (isSlashValid(sliced)) state = sliced;
      }
      trials++;
    }
    expect(trials).toBe(200);
  });
});
