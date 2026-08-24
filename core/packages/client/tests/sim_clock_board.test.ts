/**
 * ClockBoard(/sim 的魔表引擎)—— 坐标帧与步进等价性。
 *
 * 唯一真正会错的地方是帧:`@cuberoot/puzzle-solvers/clock` 把 y2 折成每步招式的绝对 side(索引**起手帧**
 * 的两个半区),同时又要求 `posit[0..8]` 恒为**当前朝己**那面。整段一次算完可以"末了再对调
 * 一次"糊过去(`clockStateFromAlg` 就是这么做的),逐步播放的引擎不行。
 *
 * 所以这里的判据只有一条,但它把两种算法逼成同一个答案:
 *   逐步喂给 board == clockStateFromAlg(整段)
 * 对每一条含 y2 的算法都成立。帧一旦搞反,含 y2 的用例立刻炸(不含 y2 的照过 —— 所以用例
 * 必须带 y2,别拿干净算法自证)。
 */
import { describe, expect, it } from 'vitest';
import ClockBoard, {
  clockGestureToken, clockSignedDelta, clockStepToken, clockStepsToString, clockSweep,
  parseClockSteps,
} from '@/app/[lang]/sim/engine/clock/clockBoard';
import {
  SOLVED_CLOCK, applyClockMoves, clockMoveDelta, clockStateFromAlg, invertClockMoves,
  isClockSolved, parseClockMoves, randomClockScramble, randomClockState, reduceClockAlg,
  solveClock,
} from '@cuberoot/puzzle-solvers/clock';

/** 逐步喂:每步 applyMoveInstant,拿最终的规范状态。 */
function stepThrough(alg: string) {
  const board = new ClockBoard();
  board.reset();
  for (const step of parseClockSteps(alg)) board.applyMoveInstant(step);
  return board.state;
}

const WITH_Y2 = [
  'y2',
  'UR2+ y2 DL3-',
  'y2 UR2+',
  'UR2+ y2 UR2+',
  'UL1+ UR2+ DL3+ DR4+ U5+ R6+ D1- L2- ALL3- y2 U4+ R5- D6+ L1+ ALL2+',
  'ALL1+ y2 ALL1+ y2 ALL1+',
  'y2 y2 UR3+',
  'UR1+ DR2+ y2 UL3+ DL4+ y2 UR5+',
];

const WITHOUT_Y2 = ['UR2+', 'ALL6+', 'UL1+ UR2+ DL3+ DR4+', 'U3- R4+ D5- L6+'];

describe('ClockBoard —— 起手帧 vs 朝己帧', () => {
  it('逐步播放 == 整段求值(含 y2 的算法)', () => {
    for (const alg of WITH_Y2) {
      const stepped = stepThrough(alg);
      const whole = clockStateFromAlg(alg);
      expect(stepped.posit, `posit mismatch: ${alg}`).toEqual(whole.posit.map((v) => ((v % 12) + 12) % 12));
      expect(stepped.rightSideUp, `rightSideUp mismatch: ${alg}`).toBe(whole.rightSideUp);
    }
  });

  it('不含 y2 的算法也一致(对照组 —— 帧搞反时这组照过,所以它证不了什么)', () => {
    for (const alg of WITHOUT_Y2) {
      expect(stepThrough(alg).posit).toEqual(clockStateFromAlg(alg).posit.map((v) => ((v % 12) + 12) % 12));
    }
  });

  it('y2 只换姿势,不动任何盘位', () => {
    const board = new ClockBoard();
    board.reset();
    board.applyMoveInstant({ kind: 'move', move: parseClockMoves('UR3+')[0] });
    const before = board.state;
    board.applyMoveInstant({ kind: 'flip' });
    const after = board.state;
    // 朝己帧下两个 9 元块对调,姿势翻转;物理上一格没动。
    expect(after.rightSideUp).toBe(!before.rightSideUp);
    expect(after.posit).toEqual([...before.posit.slice(9), ...before.posit.slice(0, 9)]);
  });
});

describe('ClockBoard —— 步骤记号', () => {
  it('history 整段重放 == 逐步播放(序列里夹着 flip 也不带偏后续招式)', () => {
    // 这是 undo/redo 真正走的路径:`init + history.moves.join(' ')` 原样再解析一次。
    for (const alg of WITH_Y2) {
      const board = new ClockBoard();
      board.twister.setup('');
      for (const step of parseClockSteps(alg)) board.applyMoveInstant(step);
      const replayed = clockStateFromAlg(board.history.moves.join(' '));
      expect(replayed.posit.map((v) => ((v % 12) + 12) % 12), alg).toEqual(board.state.posit);
      expect(replayed.rightSideUp, alg).toBe(board.state.rightSideUp);
    }
  });

  it('clockStepToken 认帧:异侧才包 y2,同侧直接写名字', () => {
    const front = parseClockMoves('UR2+')[0];           // side 0
    const back = parseClockMoves('y2 UR2+')[0];         // side 1
    expect(clockStepToken({ kind: 'move', move: front }, 0)).toBe('UR2+');
    expect(clockStepToken({ kind: 'move', move: back }, 1)).toBe('UR2+');
    expect(clockStepToken({ kind: 'move', move: front }, 1)).toBe('y2 UR2+ y2');
    expect(clockStepToken({ kind: 'move', move: back }, 0)).toBe('y2 UR2+ y2');
    expect(clockStepToken({ kind: 'flip' }, 0)).toBe('y2');
  });

  it('clockStepsToString 与逐步播放同态', () => {
    for (const alg of [...WITH_Y2, ...WITHOUT_Y2]) {
      const steps = parseClockSteps(alg);
      const text = clockStepsToString(steps);
      const viaText = clockStateFromAlg(text);
      const direct = stepThrough(alg);
      expect(viaText.posit.map((v) => ((v % 12) + 12) % 12), `alg: ${alg} → ${text}`).toEqual(direct.posit);
      expect(viaText.rightSideUp, `alg: ${alg} → ${text}`).toBe(direct.rightSideUp);
    }
  });

  // 手势的记号规则(画板半区 → 解法框 token)。判据不是"字符串长什么样",而是**转出来的
  // 那一格必须落在用户手指按的那个半区上**,且解法串里前面有几个 y2 都不能带偏它 —— 所以
  // 逐条前缀都验一遍(前缀奇偶 = 当前朝己面)。
  it('clockGestureToken:转哪个半区就落哪个半区,与解法串前缀的 y2 奇偶无关', () => {
    for (const prefix of ['', 'y2', 'UR1+', 'UR1+ y2 DL2+', 'ALL1+ y2 ALL1+ y2']) {
      for (const panel of [0, 1] as const) {
        const before = clockStateFromAlg(prefix);
        const token = clockGestureToken({ side: panel, mask: 0b1111, amount: 3 });
        const after = clockStateFromAlg(prefix ? `${prefix} ${token}` : token);
        const at = (s: typeof before, i: number) => ((s.posit[i] % 12) + 12) % 12;
        // ALL3+ 在朝己那面 9 个盘全 +3;半区下标 0 = 朝己(posit[0..8])、1 = 背面。
        const base = panel === 0 ? 0 : 9;
        const tag = `prefix="${prefix}" panel=${panel}`;
        for (let i = 0; i < 9; i++) {
          expect(((at(after, base + i) - at(before, base + i)) % 12 + 12) % 12, `${tag} dial ${base + i}`).toBe(3);
        }
        // 姿势不能被手势带走(右半区那对 y2 必须自成闭包)。
        expect(after.rightSideUp, tag).toBe(before.rightSideUp);
      }
    }
  });

  it('parseClockSteps 的招式序与 parseClockMoves 逐条相同', () => {
    for (const alg of [...WITH_Y2, ...WITHOUT_Y2]) {
      const fromSteps = parseClockSteps(alg)
        .filter((s): s is { kind: 'move'; move: ReturnType<typeof parseClockMoves>[number] } => s.kind === 'move')
        .map((s) => s.move);
      expect(fromSteps, alg).toEqual(parseClockMoves(alg));
    }
  });
});

describe('ClockBoard —— 动画扫动量', () => {
  it('扫动格数取记号写法的方向(1..6 正扫,7..11 反扫)', () => {
    expect(clockSweep(0)).toBe(0);
    expect(clockSweep(1)).toBe(1);
    expect(clockSweep(6)).toBe(6);
    expect(clockSweep(7)).toBe(-5);  // 写作 5-
    expect(clockSweep(11)).toBe(-1); // 写作 1-
  });

  it('带符号增量 mod 12 后 == clockMoveDelta(动画只改方向,不改落点)', () => {
    for (const alg of ['UR2+', 'ALL5-', 'U3+ R4-', 'y2 DL1-', 'UL+DR6+']) {
      for (const m of parseClockMoves(alg)) {
        const signed = clockSignedDelta(m).map((v) => ((v % 12) + 12) % 12);
        expect(signed, alg).toEqual(clockMoveDelta(m.side, m.mask, m.amount));
      }
    }
  });

  it('静止时每个盘的动画偏转恒为 0', () => {
    const board = new ClockBoard();
    board.reset();
    board.applyMoveInstant({ kind: 'move', move: parseClockMoves('ALL4+')[0] });
    for (let d = 0; d < 18; d++) expect(board.animOffset(d)).toBe(0);
  });
});

// 这三个算子住在 `@cuberoot/puzzle-solvers/clock`,但测试放这儿:那边的 `clock_solver.test.ts` 名字命中
// `*_solver.test.ts`,默认不进 CI(走 `test:solvers`)。播放条按钮直接依赖它们,得每次 CI 都跑。
describe('魔表算法算子(消步 / 取逆 / 打乱)', () => {
  const ALGS = [...WITH_Y2, ...WITHOUT_Y2];

  it('消步不改状态,且不改末尾姿势', () => {
    for (const alg of ALGS) {
      const before = clockStateFromAlg(alg);
      const after = clockStateFromAlg(reduceClockAlg(alg));
      expect(after.posit, `${alg} → ${reduceClockAlg(alg)}`).toEqual(before.posit);
      expect(after.rightSideUp, `${alg} → ${reduceClockAlg(alg)}`).toBe(before.rightSideUp);
    }
  });

  it('消步真的变短(同组合的招式合并掉)', () => {
    // ALL 三次 1+ = 一次 3+;U 一次 5+ 一次 7+ = 12 ≡ 0,整步消失。
    expect(reduceClockAlg('ALL1+ ALL1+ ALL1+')).toBe('ALL3+');
    expect(reduceClockAlg('U5+ U7+')).toBe('');
    expect(reduceClockAlg('UR2+ UR2+ UR2+ UR2+ UR2+ UR2+')).toBe('');
  });

  it('原算法接上它的逆 = 还原态', () => {
    for (const alg of ALGS) {
      const moves = parseClockMoves(alg);
      // 在**起手帧**里首尾相接(不走 clockStateFromAlg —— 它末了会按翻面与否对调半区,
      // 而招式的 side 是起手帧的绝对值,对调过再施加逆就对不上了)。
      const back = applyClockMoves(SOLVED_CLOCK(), [...moves, ...invertClockMoves(moves)]);
      expect(isClockSolved(back), alg).toBe(true);
    }
  });

  it('取逆是对合:逆的逆 == 原招式', () => {
    for (const alg of ALGS) {
      const moves = parseClockMoves(alg);
      expect(invertClockMoves(invertClockMoves(moves)), alg).toEqual(moves);
    }
  });

  it('随机打乱可解,且解出来的步数 ≤ 12(上帝之数)', () => {
    for (let i = 0; i < 40; i++) {
      const scramble = randomClockScramble();
      const sol = solveClock(clockStateFromAlg(scramble));
      expect(sol.length, scramble).toBeLessThanOrEqual(12);
      expect(isClockSolved(applyClockMoves(clockStateFromAlg(scramble), sol.moves)), scramble).toBe(true);
    }
  });
});

describe('ClockBoard —— 引擎契约', () => {
  it('reset 回还原态、complete 为真', () => {
    const board = new ClockBoard();
    board.applyMoveInstant({ kind: 'move', move: parseClockMoves('UR5+')[0] });
    expect(board.complete).toBe(false);
    board.reset();
    expect(board.complete).toBe(true);
    expect(isClockSolved(board.state)).toBe(true);
  });

  it('setState / state 往返(含翻面态)', () => {
    const board = new ClockBoard();
    for (const flipped of [false, true]) {
      const s = randomClockState();
      s.rightSideUp = !flipped;
      board.setState(s);
      expect(board.state.posit).toEqual(s.posit.map((v) => ((v % 12) + 12) % 12));
      expect(board.state.rightSideUp).toBe(s.rightSideUp);
    }
  });

  it('setup(打乱) 后 board 的状态可被求解器解掉', () => {
    const board = new ClockBoard();
    const scramble = 'UR2+ DR3- DL1+ UL4+ U5+ R6+ D2- L3- ALL1- y2 U4+ R2- D6+ L1+ ALL3+';
    board.twister.setup(scramble);
    expect(board.state.posit).toEqual(clockStateFromAlg(scramble).posit.map((v) => ((v % 12) + 12) % 12));
    const sol = solveClock(board.state);
    const after = applyClockMoves(board.state, sol.moves);
    expect(isClockSolved(after)).toBe(true);
  });

  it('setup 清空 history,applyMoveInstant 记一条', () => {
    const board = new ClockBoard();
    board.twister.setup('UR2+ y2 DL1+');
    expect(board.history.moves).toEqual([]);
    board.applyMoveInstant({ kind: 'move', move: parseClockMoves('ALL1+')[0] });
    expect(board.history.moves).toHaveLength(1);
  });

  it('undo / redo 沿 history 重放回同一状态', () => {
    const board = new ClockBoard();
    board.twister.setup('');
    const steps = parseClockSteps('UR2+ y2 DL3- ALL1+');
    for (const s of steps) board.applyMoveInstant(s);
    const full = board.state;
    board.twister.undo();
    expect(board.state.posit).not.toEqual(full.posit);
    board.twister.redo();
    expect(board.state.posit).toEqual(full.posit);
    expect(board.state.rightSideUp).toBe(full.rightSideUp);
  });

  it('还原态的空算法 == SOLVED_CLOCK', () => {
    const board = new ClockBoard();
    board.twister.setup('');
    expect(board.state).toEqual(SOLVED_CLOCK());
  });
});
