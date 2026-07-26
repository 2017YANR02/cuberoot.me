import { describe, it, expect } from 'vitest';
import { sq1MoveCounts } from '@/lib/sq1-metrics';
import { applySq1Scramble } from '@cuberoot/shared/sq1-notation';
import { solveSq1, __sq1SelfTest } from '@/app/[lang]/timer/_lib/solver/sq1';

describe('sq1 move-count metrics (lib/sq1-metrics)', () => {
  it('counts the three metrics on known sequences', () => {
    // "/" always 1 in every metric; only layer turns differ.
    expect(sq1MoveCounts('')).toMatchObject({ twist: 0, wca: 0, face: 0 });
    expect(sq1MoveCounts('/')).toMatchObject({ twist: 1, wca: 1, face: 1 });
    // single-layer (3,0): twist 1 (slice only), wca 2 (turn+slice), face 2 (1 face turn + slice)
    expect(sq1MoveCounts('(3,0)/')).toMatchObject({ twist: 1, wca: 2, face: 2, doubleTurns: 0 });
    // double (3,3): twist 1, wca 2, face 3 (2 face turns + slice)
    expect(sq1MoveCounts('(3,3)/')).toMatchObject({ twist: 1, wca: 2, face: 3, doubleTurns: 1 });
  });

  it('aggregates a multi-move sequence correctly', () => {
    const c = sq1MoveCounts('(1,0)/(-3,3)/(0,-3)/');
    expect(c.slices).toBe(3);
    expect(c.turns).toBe(3);
    expect(c.twist).toBe(3); // only the 3 slices
    expect(c.wca).toBe(6); // 3 non-trivial turns + 3 slices
    expect(c.face).toBe(7); // 1 + 2 + 1 face turns + 3 slices
    expect(c.doubleTurns).toBe(1); // (-3,3)
  });

  it('an identity (0,0) turn is free in every metric', () => {
    const c = sq1MoveCounts('(0,0)/');
    expect(c).toMatchObject({ twist: 1, wca: 1, face: 1, nonIdentityTurns: 0 });
  });
});

// ⚠️ 退役引擎(2026-07-26)。app 代码已不用它,这个 describe 留着是为了**把它的局限钉住**:
// 它的状态串只按 {顶棱/顶角/底棱/底角} 四类打标,同层内的块彼此不可分、赤道朝向也不跟踪,
// 所以「解」只还原形状 + 分层,不是真还原。原来这里的 round-trip 用它自己当判据(自证),
// 所以从没抓到。真判据(tnoodle 件位模型)在 tests/sq1_solver_oracle.test.ts。
describe('solveSq1 —— 退役引擎:只还原形状 + 分层,不是真解', () => {
  it('built-in self-test passes', () => {
    expect(__sq1SelfTest()).toMatch(/^OK:/);
  });

  // 独立判据(与 sq1_solver_oracle.test.ts 同一份 tnoodle 件位模型)。
  const SOLVED_PIECES = [
    0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7,
    8, 9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 15,
  ];
  const trulySolved = (alg: string): boolean => {
    const st = applySq1Scramble(alg);
    return st.sliceSolved && st.pieces.every((p, i) => p === SOLVED_PIECES[i]);
  };

  it('单个层转被它判成「已还原」(0 步),而件位模型说没还原', () => {
    expect(solveSq1('(1,0)').stages.flatMap((s) => s.moves).join(' ')).toBe('');
    expect(trulySolved('(1,0)')).toBe(false);
  });

  const SCRAMBLES = [
    '(1,2)/(6,6)/(4,-3)/(6,5)/(6,-3)/(-5,3)/(-1,-3)/(6,6)/(-3,-3)/',
    '(1,3)/(5,5)/(3,0)/(-5,-2)/(-4,5)/(-5,-5)/(-1,0)/(3,0)/(-5,0)/(-4,0)/(-2,0)/(-2,0)/',
  ];

  it.each(SCRAMBLES)('自证「解开了」但件位模型说没还原:%s', (scramble) => {
    const res = solveSq1(scramble);
    expect(res.stages.length).toBe(2);
    expect(res.stages.some((s) => s.failed)).toBe(false);

    const solution = res.stages.flatMap((s) => s.moves).join(' ');
    // 自证:拿同一个引擎复查,它说 0 步 —— 这正是当年漏掉 bug 的那一步。
    expect(solveSq1(`${scramble} ${solution}`).totalMoves).toBe(0);
    // 真相:换独立模型看,根本没还原。
    expect(trulySolved(`${scramble} ${solution}`)).toBe(false);

    // 度量不变式与引擎无关,仍然成立:twist ≤ WCA ≤ face。
    const c = sq1MoveCounts(solution);
    expect(c.twist).toBeLessThanOrEqual(c.wca);
    expect(c.wca).toBeLessThanOrEqual(c.face);
    expect(c.face).toBeLessThanOrEqual(res.totalMoves);
  });
});
