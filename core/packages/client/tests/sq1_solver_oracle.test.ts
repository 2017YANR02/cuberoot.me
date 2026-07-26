// Square-1 求解器的正确性判据 —— 解完真的还原了吗?
//
// 引擎 = cstimer 自带的 sq1 两阶段搜索(cs0x7f 的 sq12phase,
// tools/cstimer-scramble/scramble/scramble_sq1_new.js,由我们加的 `solveScramble` 包一层),
// 走 scrambler.worker.js 的 SOLVERS 注册表给 /scramble/solver?event=sq1 用。近最优,不是可证最优;
// 契约只有一条:**scramble ∘ solution = 还原**。
//
// 判据必须来自另一套模型,否则是自证:这里用 shared 的 `applySq1Scramble`
// (tnoodle SquareOnePuzzle 派生的 24 槽件位模型),与 cstimer 那套 4×6 nibble 环表示无关。
// 打乱来源也是 cstimer 自己的 random-state 生成器(真题分布,不是手编的)。
//
// 历史:这一页原先用 timer/_lib/solver/sq1 的 cstimer gsolver 移植,状态串只按
// {顶棱/顶角/底棱/底角} 四类打标,分不出同层内的具体块、也不跟踪赤道朝向 → 它的「解」只把
// 形状和分层还原,单个层转(如 (1,0))甚至被判成「已是还原态」。本测试锁住那个 bug 不回来。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { applySq1Scramble, parseSq1Tokens } from '@cuberoot/shared/sq1-notation';

const SOLVED_PIECES = [
  0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7,
  8, 9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 15,
];

/** 独立判据:件位全归位 + 赤道正向。 */
function isSolved(alg: string): boolean {
  const st = applySq1Scramble(alg);
  return st.sliceSolved && st.pieces.every((p, i) => p === SOLVED_PIECES[i]);
}

function cstimerRoot(file: string): string | null {
  const candidates = [
    path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..', 'tools', 'cstimer-scramble'),
    path.resolve(process.cwd(), '..', '..', 'tools', 'cstimer-scramble'),
    path.resolve(process.cwd(), '..', '..', '..', 'tools', 'cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  for (const c of candidates) { try { if (fs.existsSync(path.join(c, file))) return c; } catch { /* ignore */ } }
  return null;
}

interface CstimerSq1 {
  solveScramble: (scramble: string) => string;
  selfCheck: (scramble: string) => boolean;
}

const FILES = [
  'lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js',
  'scramble/scramble.js', 'scramble/scramble_sq1_new.js',
];

function loadCstimerSq1(): { sq1: CstimerSq1; randomScramble: () => string } | null {
  const root = cstimerRoot('scramble/scramble_sq1_new.js');
  if (!root) return null;
  const require = createRequire(import.meta.url);
  const sandbox: Record<string, unknown> = Object.create(null);
  sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.global = sandbox;
  sandbox.console = console; sandbox.setTimeout = setTimeout; sandbox.clearTimeout = clearTimeout;
  sandbox.kernel = { getProp: () => '', setProp() {}, regProp() {}, regListener() {}, pushSignal() {} };
  // utillib 的 isInNode 探测要 process + require + global 都在,否则它走 main 分支、$ 不定义。
  sandbox.DEBUG = false; sandbox.importScripts = () => {};
  sandbox.process = process; sandbox.require = require; sandbox.Math = Math;
  const ctx = vm.createContext(sandbox);
  for (const f of FILES) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  const sq1 = vm.runInContext('sq1', ctx) as CstimerSq1;
  const gen = vm.runInContext('scrMgr.scramblers["sqrs"]', ctx) as
    (key: string, len: number, cases?: unknown) => string | undefined;
  const randomScramble = (): string => {
    // cstimer 的 scrambler 在剪枝表还没建完时会返回 undefined,上游 UI 靠定时器重调。
    for (let i = 0; i < 5000; i++) {
      const out = gen('sqrs', 0, undefined);
      if (out !== undefined) return String(out).replace(/`/g, '').replace(/\s+/g, ' ').trim();
    }
    throw new Error('cstimer sqrs scrambler never returned');
  };
  return { sq1, randomScramble };
}

const ENGINE = loadCstimerSq1();

describe.skipIf(ENGINE === null)('sq1 solveScramble — scramble ∘ solution = solved', () => {
  const { sq1, randomScramble } = ENGINE!;

  it('判据自检:还原串是还原,单个层转不是', () => {
    expect(isSolved('')).toBe(true);
    expect(isSolved('(1,0)')).toBe(false);
    expect(isSolved('(0,-1)')).toBe(false);
    expect(isSolved('(1,0)(-1,0)')).toBe(true);
  });

  it('还原态 → 空解', () => {
    expect(sq1.solveScramble('')).toBe('');
  });

  // 单层转:老引擎在这里报「已是还原态」。
  it.each(['(1,0)', '(0,-1)', '(-3,-1)', '(6,6)', '(1,1)'])('单层转 %s 有解且真还原', (scramble) => {
    const sol = sq1.solveScramble(scramble);
    expect(sol).not.toBe('');
    expect(isSolved(`${scramble} ${sol}`)).toBe(true);
  });

  // 切割线被角劈开的状态((2,0) / (5,0) 从还原态转出来就是):cstimer 的形状模型索引不到,
  // 靠 solveScramble 里的「先补一个最小层转对齐」兜住。
  it.each(['(2,0)', '(5,0)', '(0,2)', '(2,-2)'])('切不了刀的状态 %s 也有解', (scramble) => {
    const sol = sq1.solveScramble(scramble);
    expect(isSolved(`${scramble} ${sol}`)).toBe(true);
  });

  it.each([
    '(1,0)/(-3,3)/(0,-3)/(2,-1)/',
    '(1,2)/(6,6)/(4,-3)/(6,5)/(6,-3)/(-5,3)/(-1,-3)/(6,6)/(-3,-3)/',
  ])('固定打乱 %s 真还原', (scramble) => {
    expect(isSolved(`${scramble} ${sq1.solveScramble(scramble)}`)).toBe(true);
  });

  it('20 条 cstimer 真随机态打乱全部真还原', () => {
    for (let i = 0; i < 20; i++) {
      const scramble = randomScramble();
      const sol = sq1.solveScramble(scramble);
      expect(isSolved(`${scramble} ${sol}`), `scramble=${scramble} sol=${sol}`).toBe(true);
      // 近最优:WCA 12c4 口径不该超过 ~30(上帝之数未知,实测均值 ~17)。
      expect(parseSq1Tokens(sol).length).toBeLessThan(40);
    }
  });

  it('解是规范形:没有相邻的两个层转括号、没有相邻两刀', () => {
    for (const scramble of ['(2,0)', '(5,0)', '(1,0)', '(1,0)/(-3,3)/(0,-3)/(2,-1)/', randomScramble()]) {
      const toks = parseSq1Tokens(sq1.solveScramble(scramble));
      for (let i = 1; i < toks.length; i++) {
        expect(
          toks[i].kind === toks[i - 1].kind,
          `${scramble} -> ${sq1.solveScramble(scramble)} 第 ${i} 个 token 与前一个同类`,
        ).toBe(false);
      }
      // (0,0) 这种恒等括号也不该出现。
      for (const t of toks) if (t.kind === 'turn') expect(t.top !== 0 || t.bot !== 0).toBe(true);
    }
  });

  it('引擎自带的同模型 selfCheck 也过(交叉确认解析口径一致)', () => {
    for (const scramble of ['(1,0)', '(2,0)', '(1,0)/(-3,3)/(0,-3)/(2,-1)/']) {
      expect(sq1.selfCheck(scramble), scramble).toBe(true);
    }
  });
});
