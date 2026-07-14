import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import {
  tokenizeMoves, flattenAlg, expandGroups, cubeOnly, stripGripMarks, deleteAuf,
  stripUpstreamMarks, invertMoveString, toMoveString,
  stm, sqtm, htm, qtm, etm, gen,
} from '@cuberoot/shared/alg-notation';
import { cleanForPlayer, countMovesExpanded } from '@/lib/recon-alg-utils';

const kpuzzle = await cube3x3x3.kpuzzle();
const solved = kpuzzle.defaultPattern();
const sameState = (a: string, b: string) =>
  solved.applyAlg(new Alg(a)).isIdentical(solved.applyAlg(new Alg(b)));

describe('tokenizeMoves', () => {
  it('reads every shape the sheet and the site actually write', () => {
    const got = tokenizeMoves("R2' M' r 3Rw2' 2R x' Uw2 L4' R3 2-3l").moves;
    expect(got.map((m) => [m.raw, m.family, m.amount, m.kind])).toEqual([
      ["R2'", 'R', -2, 'face'],
      ["M'", 'M', -1, 'slice'],
      ['r', 'r', 1, 'wide'],
      ["3Rw2'", 'Rw', -2, 'wide'],
      ['2R', 'R', 1, 'wide'],
      ["x'", 'x', -1, 'rotation'],
      ['Uw2', 'Uw', 2, 'wide'],
      ["L4'", 'L', -4, 'face'],
      ['R3', 'R', 3, 'face'],
      ['2-3l', 'l', 1, 'wide'],
    ]);
  });

  // No-space runs are all over the sheet (`M'L`, `U'D'`, `RL`). Whitespace splitting
  // counts each run as one move; the tokenizer takes the longest match instead.
  it('splits moves written without spaces', () => {
    expect(tokenizeMoves("M'L RL U'D'").moves.map((m) => m.raw)).toEqual(["M'", 'L', 'R', 'L', "U'", "D'"]);
  });

  it('reports what it cannot read instead of dropping it', () => {
    const { moves, junk } = tokenizeMoves('R U @nonsense F');
    expect(moves.map((m) => m.raw)).toEqual(['R', 'U', 'F']);
    expect(junk).toEqual(['@nonsense']);
  });
});

describe('expandGroups', () => {
  it('expands nested repeats', () => {
    expect(expandGroups("(R U R' U (R U' R' U)2 R)")).toBe("R U R' U R U' R' U R U' R' U R");
  });

  it('throws on unbalanced parens — flattenAlg is the forgiving one', () => {
    expect(() => expandGroups('(R U')).toThrow();
    expect(flattenAlg('(R U')).toBe('R U');
  });

  // cubedb 抓来的 zbls 里有 `F' (L' U2 L U')2' F U'` —— 重复两遍**再整段取逆**。
  // 少认这一条,整条公式会被判成语法错(线上真报过)。
  it('expands a primed repeat — repeat first, then invert the whole run', () => {
    expect(expandGroups("(R U)2'")).toBe("U' R' U' R'");
    expect(expandGroups("F' (L' U2 L U')2' F")).toBe("F' U L' U2' L U L' U2' L F");
  });

  it("expands a bare primed group `(A)'`", () => {
    expect(expandGroups("(R U R')'")).toBe("R U' R'");
  });
});

describe('invertMoveString', () => {
  it('reverses and flips every step, amounts written as-is', () => {
    expect(invertMoveString("R U2 R' D3")).toBe("D3' R U2' R'");
    expect(invertMoveString("L4' M'")).toBe('M L4');
  });
});

describe('stripUpstreamMarks', () => {
  // `=` = 本条与上一条等价(上游公式库的标注);`*` 同族。都不是招式 —— 引擎面前一律剥掉,
  // 库里的原文照留。含义见 docs/alg-upstream-notation.md。
  it('drops the `=` / `*` annotations, keeps every move', () => {
    expect(stripUpstreamMarks("=y F' r U r'")).toBe("y F' r U r'");
    expect(stripUpstreamMarks("U2 =*y U' (f' L2' f)")).toBe("U2 y U' (f' L2' f)");
  });

  it('is in the canonical strip chain, so the tokenizer never sees them', () => {
    expect(toMoveString("U2 =U' (L' U2 L U) F U' F'")).toBe("U2 U' L' U2 L U F U' F'");
  });
});

describe('metrics', () => {
  // The metric is "as written / as executed", not "as a group element". R4 is the
  // identity in the group but a real full revolution of the R layer: it costs time,
  // it drives the hand animation, and the sheet writes it on purpose.
  it.each([
    // alg,                     stm, sqtm, htm, qtm, etm
    ["R U R' U'", 4, 4, 4, 4, 4],
    ['R2', 1, 2, 1, 2, 1],
    ["R2'", 1, 2, 1, 2, 1],
    ['R3', 1, 3, 1, 3, 1],
    ["L4'", 1, 4, 1, 4, 1],
    ['M', 1, 1, 2, 2, 1],
    ['M2', 1, 2, 2, 4, 1],
    ['x', 0, 0, 0, 0, 1],
    ['y2', 0, 0, 0, 0, 1],
    ['Rw', 1, 1, 1, 1, 1],
    ['r', 1, 1, 1, 1, 1],
    ["M2 U M U2 M' U M2", 7, 10, 11, 16, 7],
  ] as const)('%s → stm %i sqtm %i htm %i qtm %i etm %i', (alg, s, sq, h, q, e) => {
    expect(stm(alg)).toBe(s);
    expect(sqtm(alg)).toBe(sq);
    expect(htm(alg)).toBe(h);
    expect(qtm(alg)).toBe(q);
    expect(etm(alg)).toBe(e);
  });

  /**
   * The bug this whole module exists to kill. `lib/recon-stats.ts` counted moves by
   * deleting ` ()'xyz234·↑↓./` and measuring what was left — and `w` was not in that
   * set, so `Rw` came out as 2 moves. It only ever looked right because the 1LLL sheet
   * writes wide moves lowercase; recon text writes them `Rw`.
   */
  it('counts a wide move as one move however it is written', () => {
    for (const alg of ['Rw', "Rw'", 'Rw2', 'Uw2', 'r', "r'", '3Rw']) {
      expect(stm(alg), alg).toBe(1);
    }
    expect(stm("Rw U Rw' U'")).toBe(4);
    expect(stm("r U r' U'")).toBe(4);
  });

  it('counts through repeat groups and grip marks', () => {
    expect(stm("↑R U ·(R' F R F')2")).toBe(10);
    expect(stm('[oh] R U // trailing comment')).toBe(2);
  });
});

describe('gen', () => {
  // Case ties break by first occurrence, not by a case rule: PLL-F writes F before f
  // and gets FfRSU; PLL-Y writes f before F and gets fFRU.
  it('sorts case-insensitively, ties by first occurrence', () => {
    expect(gen("(R' F R f') (R' F R2 U R' U') (R' F' R2 U R') S")).toBe('FfRSU');
    expect(gen("(f' U f R' U' R' U R2) (U R' U' R' F R F')")).toBe('fFRU');
    expect(gen("(L2 u L' U) (L' U' L u') (L2' f' L f)")).toBe('fLuU');
  });

  it('leaves rotations out', () => {
    expect(gen("x R' U R' D2 R U' R' D2 R2 x'")).toBe('DRU');
  });
});

describe('deleteAuf', () => {
  it('drops a leading U-family turn and nothing else', () => {
    expect(deleteAuf("U R U R' U'")).toBe("R U R' U'");
    expect(deleteAuf("U2' R U R'")).toBe("R U R'");
    expect(deleteAuf("R U R'")).toBe("R U R'");
    expect(deleteAuf("(U R U') R")).toBe("(U R U') R");
  });

  /** The sheet's regex is `^U2'?|^U'|^U`, which bites the U out of `Uw` and `U3`. */
  it('does not bite into Uw or U3', () => {
    expect(deleteAuf("Uw R U R'")).toBe("Uw R U R'");
    expect(deleteAuf("U3 R U R'")).toBe("R U R'");
  });
});

describe('stripGripMarks', () => {
  /**
   * FINGERTRICKS §7.3: grip marks become a SPACE, never an empty string. Deleting
   * them outright glues `R·U` into `RU`, and `new Alg("RU")` does not throw — cubing.js
   * silently swallows it as one move whose family is "RU".
   */
  it('leaves a space behind so neighbouring moves cannot fuse', () => {
    expect(stripGripMarks("R·U R'")).toBe('R U R\'');
    expect(cubeOnly("↑R U ·R'")).toBe("R U R'");
  });

  it('cubing.js really does swallow a fused pair — this is why the space matters', () => {
    expect(() => new Alg('RU')).not.toThrow();
    expect([...new Alg('RU').experimentalLeafMoves()]).toHaveLength(1);
  });
});

/**
 * `cleanForPlayer` strips the same marks to an empty string, which would fuse moves —
 * but an autospace pass right after re-splits them. Pin the end-to-end behaviour so a
 * future edit to either half cannot quietly reintroduce the fusion.
 */
describe('recon cleanForPlayer keeps grip-marked algs playable', () => {
  it.each([
    ["R·U R'", "R U R'"],
    ["U'·R U", "U' R U"],
    ["↑R U R' U'", "R U R' U'"],
    ["R2'·U R", "R2' U R"],
  ])('%s → %s', (input, want) => {
    const got = cleanForPlayer(input);
    expect(got.replace(/\s+/g, ' ').trim()).toBe(want);
    expect(sameState(got, want)).toBe(true);
  });

  it('agrees with the shared tokenizer on how many moves that is', () => {
    expect(countMovesExpanded(cleanForPlayer("R·U R'"))).toBe(3);
    expect(etm(cleanForPlayer("↑R U ·(R' F R F')2"))).toBe(10);
  });
});
